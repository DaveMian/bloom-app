import UIKit
import Capacitor
import UserNotifications
import WidgetKit
import AVFoundation
import AudioToolbox

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate, UNUserNotificationCenterDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        setupAudioFiles()
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playback, mode: .default, options: [.mixWithOthers])
            try session.setActive(true)
        } catch {
            print("AVAudioSession setup error: \(error)")
        }
        return true
    }

    private func setupAudioFiles() {
        let fileManager = FileManager.default
        guard let libraryDir = fileManager.urls(for: .libraryDirectory, in: .userDomainMask).first else { return }
        let soundsDir = libraryDir.appendingPathComponent("Sounds")
        try? fileManager.createDirectory(at: soundsDir, withIntermediateDirectories: true)
        let files = ["bloom_alarm.wav", "calm.wav", "rain.wav", "breeze.wav", "silence.wav"]
        for f in files {
            let destUrl = soundsDir.appendingPathComponent(f)
            let name = (f as NSString).deletingPathExtension
            let ext = (f as NSString).pathExtension
            if !fileManager.fileExists(atPath: destUrl.path) {
                if let sourceUrl = Bundle.main.url(forResource: name, withExtension: ext) ??
                                   Bundle.main.url(forResource: "public/\(name)", withExtension: ext) {
                    try? fileManager.copyItem(at: sourceUrl, to: destUrl)
                }
            }
        }
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                willPresent notification: UNNotification,
                                withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        if #available(iOS 14.0, *) {
            completionHandler([.banner, .sound, .badge, .list])
        } else {
            completionHandler([.alert, .sound, .badge])
        }
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                didReceive response: UNNotificationResponse,
                                withCompletionHandler completionHandler: @escaping () -> Void) {
        NotificationCenter.default.post(name: NSNotification.Name("BloomStopAlarm"), object: nil)
        completionHandler()
    }

    func applicationWillResignActive(_ application: UIApplication) {}
    func applicationDidEnterBackground(_ application: UIApplication) {}
    func applicationWillEnterForeground(_ application: UIApplication) {}
    func applicationDidBecomeActive(_ application: UIApplication) {}
    func applicationWillTerminate(_ application: UIApplication) {}

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default Configuration",
                                          sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }
}

@objc(BloomNativePlugin)
public class BloomNativePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "BloomNativePlugin"
    public let jsName = "BloomNative"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "checkPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "scheduleReminders", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancelReminders", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "sendTest", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "updateWidget", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "scheduleTimerNotification", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancelTimerNotification", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "playAlarmSound", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopAlarmSound", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startAmbientSound", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopAmbientSound", returnType: CAPPluginReturnPromise)
    ]

    private let hydrationIds = (0...23).map { "bloom-hydration-\($0)" }
    private let eveningId = "bloom-evening-summary"
    private let timerNotificationId = "bloom-timer-completion"
    private let stagedTimerIds = (0..<5).map { "bloom-timer-stage-\($0)" }
    private let suiteName = "group.app.bloom.routine"

    private var ambientPlayer: AVAudioPlayer?
    private var silencePlayer: AVAudioPlayer?
    private var alarmPlayer: AVAudioPlayer?
    private var alarmVibrateTimer: Timer?
    private var nativeCountdownTimer: Timer?

    public override func load() {
        super.load()
        NotificationCenter.default.addObserver(self, selector: #selector(handleStopAlarmNotification), name: NSNotification.Name("BloomStopAlarm"), object: nil)
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    @objc private func handleStopAlarmNotification() {
        stopAlarmSoundInternal()
        cleanupTimerNotifications()
    }

    @objc public override func checkPermissions(_ call: CAPPluginCall) {
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            let status: String
            switch settings.authorizationStatus {
            case .authorized, .provisional, .ephemeral:
                status = "granted"
            case .denied:
                status = "denied"
            case .notDetermined:
                status = "prompt"
            @unknown default:
                status = "prompt"
            }
            call.resolve(["display": status])
        }
    }

    @objc public override func requestPermissions(_ call: CAPPluginCall) {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { granted, error in
            if let error = error {
                call.resolve(["display": "error", "message": error.localizedDescription])
                return
            }
            call.resolve(["display": granted ? "granted" : "denied"])
        }
    }

    @objc func scheduleReminders(_ call: CAPPluginCall) {
        let interval = max(1, min(6, call.getInt("intervalHours", 2)))
        let startHour = max(0, min(23, call.getInt("startHour", 9)))
        let endHour = max(startHour, min(23, call.getInt("endHour", 21)))
        let eveningEnabled = call.getBool("eveningEnabled", true)
        let eveningHour = max(0, min(23, call.getInt("eveningHour", 20)))
        let tzIdentifier = call.getString("timezone", "")
        let timeZone = (!tzIdentifier.isEmpty ? TimeZone(identifier: tzIdentifier) : nil) ?? TimeZone.current
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: hydrationIds + [eveningId])

        var scheduled = 0
        var hour = startHour
        while hour <= endHour {
            let content = UNMutableNotificationContent()
            content.title = "Bloom · Gentle sip"
            content.body = "A little pause for a glass of water. Your body will thank you."
            content.sound = .default
            var date = DateComponents()
            date.calendar = Calendar(identifier: .gregorian)
            date.timeZone = timeZone
            date.hour = hour
            date.minute = 0
            center.add(UNNotificationRequest(identifier: "bloom-hydration-\(hour)", content: content, trigger: UNCalendarNotificationTrigger(dateMatching: date, repeats: true)))
            scheduled += 1
            hour += interval
        }

        if eveningEnabled {
            let content = UNMutableNotificationContent()
            content.title = "Bloom · Your evening pause"
            content.body = "Open Bloom to notice today’s small wins and save one lovely thing."
            content.sound = .default
            var date = DateComponents()
            date.calendar = Calendar(identifier: .gregorian)
            date.timeZone = timeZone
            date.hour = eveningHour
            date.minute = 0
            center.add(UNNotificationRequest(identifier: eveningId, content: content, trigger: UNCalendarNotificationTrigger(dateMatching: date, repeats: true)))
            scheduled += 1
        }

        if let jsonString = call.getString("routinesJson"),
           let data = jsonString.data(using: .utf8),
           let list = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] {
            for (idx, item) in list.prefix(40).enumerated() {
                guard let title = item["title"] as? String,
                      let hour = item["hour"] as? Int,
                      let minute = item["minute"] as? Int,
                      let weekdays = item["weekdays"] as? [Int] else { continue }
                for wd in weekdays {
                    let content = UNMutableNotificationContent()
                    content.title = "Bloom · \(title)"
                    content.body = "Time for your scheduled routine: \(title)"
                    content.sound = .default
                    var date = DateComponents()
                    date.calendar = Calendar(identifier: .gregorian)
                    date.timeZone = timeZone
                    date.weekday = wd + 1
                    date.hour = hour
                    date.minute = minute
                    let reqId = "bloom-routine-\(idx)-\(wd)"
                    center.add(UNNotificationRequest(identifier: reqId, content: content, trigger: UNCalendarNotificationTrigger(dateMatching: date, repeats: true)))
                    scheduled += 1
                }
            }
        }
        call.resolve(["scheduled": scheduled])
    }

    @objc func cancelReminders(_ call: CAPPluginCall) {
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: hydrationIds + [eveningId])
        center.getPendingNotificationRequests { requests in
            let oldRoutineIds = requests.filter { $0.identifier.hasPrefix("bloom-routine-") }.map { $0.identifier }
            if !oldRoutineIds.isEmpty {
                center.removePendingNotificationRequests(withIdentifiers: oldRoutineIds)
            }
        }
        call.resolve()
    }

    private func getAudioUrl(named name: String) -> URL? {
        let cleanName = (name as NSString).deletingPathExtension
        let ext = (name as NSString).pathExtension.isEmpty ? "wav" : (name as NSString).pathExtension

        if let url = Bundle.main.url(forResource: cleanName, withExtension: ext) {
            return url
        }
        if let url = Bundle.main.url(forResource: "public/\(cleanName)", withExtension: ext) {
            return url
        }
        if let libDir = FileManager.default.urls(for: .libraryDirectory, in: .userDomainMask).first {
            let soundUrl = libDir.appendingPathComponent("Sounds/\(cleanName).\(ext)")
            if FileManager.default.fileExists(atPath: soundUrl.path) {
                return soundUrl
            }
        }
        return nil
    }

    @objc func startAmbientSound(_ call: CAPPluginCall) {
        let type = call.getString("type", "").lowercased()
        let volume = Float(call.getDouble("volume", 0.35))

        guard type == "rain" || type == "breeze" || type == "calm" else {
            stopAmbientSoundInternal()
            if nativeCountdownTimer != nil {
                startSilenceInternal()
            }
            call.resolve(["status": "stopped"])
            return
        }

        stopAmbientSoundInternal()
        stopSilenceInternal()

        guard let url = getAudioUrl(named: "\(type).wav") else {
            call.resolve(["status": "file_not_found", "type": type])
            return
        }

        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playback, mode: .default, options: [.mixWithOthers])
            try session.setActive(true)

            let player = try AVAudioPlayer(contentsOf: url)
            player.numberOfLoops = -1
            player.volume = max(0.05, min(1.0, volume))
            player.prepareToPlay()
            player.play()
            ambientPlayer = player
            call.resolve(["status": "playing", "type": type])
        } catch {
            call.reject("Ambient audio error: \(error.localizedDescription)")
        }
    }

    @objc func stopAmbientSound(_ call: CAPPluginCall) {
        stopAmbientSoundInternal()
        if nativeCountdownTimer != nil {
            startSilenceInternal()
        }
        call.resolve(["status": "stopped"])
    }

    private func stopAmbientSoundInternal() {
        ambientPlayer?.stop()
        ambientPlayer = nil
    }

    private func startSilenceInternal() {
        if ambientPlayer?.isPlaying == true { return }
        guard let url = getAudioUrl(named: "silence.wav") else { return }
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playback, mode: .default, options: [.mixWithOthers])
            try session.setActive(true)

            let player = try AVAudioPlayer(contentsOf: url)
            player.numberOfLoops = -1
            player.volume = 0.01
            player.prepareToPlay()
            player.play()
            silencePlayer = player
        } catch {
            print("Silence audio error: \(error)")
        }
    }

    private func stopSilenceInternal() {
        silencePlayer?.stop()
        silencePlayer = nil
    }

    @objc func playAlarmSound(_ call: CAPPluginCall) {
        playAlarmSoundInternal()
        call.resolve(["status": "playing"])
    }

    @objc func stopAlarmSound(_ call: CAPPluginCall) {
        stopAlarmSoundInternal()
        call.resolve(["status": "stopped"])
    }

    private func playAlarmSoundInternal() {
        stopAlarmSoundInternal()
        stopSilenceInternal()

        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.playback, mode: .default, options: [.mixWithOthers])
        try? session.setActive(true)

        if let url = getAudioUrl(named: "bloom_alarm.wav") {
            do {
                let player = try AVAudioPlayer(contentsOf: url)
                player.numberOfLoops = 0
                player.volume = 1.0
                player.prepareToPlay()
                player.play()
                alarmPlayer = player
            } catch {
                print("Alarm audio error: \(error)")
            }
        }

        triggerVibrationPulse()
        var pulses = 1
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.alarmVibrateTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] timer in
                guard let self = self else {
                    timer.invalidate()
                    return
                }
                pulses += 1
                if pulses >= 5 {
                    timer.invalidate()
                    self.alarmVibrateTimer = nil
                } else {
                    self.triggerVibrationPulse()
                }
            }
        }
    }

    private func triggerVibrationPulse() {
        AudioServicesPlaySystemSound(kSystemSoundID_Vibrate)
        DispatchQueue.main.async {
            let generator = UIImpactFeedbackGenerator(style: .heavy)
            generator.prepare()
            generator.impactOccurred()
        }
    }

    private func stopAlarmSoundInternal() {
        alarmPlayer?.stop()
        alarmPlayer = nil
        alarmVibrateTimer?.invalidate()
        alarmVibrateTimer = nil
    }

    @objc func scheduleTimerNotification(_ call: CAPPluginCall) {
        let seconds = call.getDouble("seconds", 0)
        let title = call.getString("title", "Bloom · Timer complete")
        let body = call.getString("body", "Great session! Open Bloom to mark it complete.")

        guard seconds > 0 else {
            call.reject("Timer duration must be greater than 0 seconds")
            return
        }

        if ambientPlayer?.isPlaying != true {
            startSilenceInternal()
        }

        nativeCountdownTimer?.invalidate()
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.nativeCountdownTimer = Timer.scheduledTimer(withTimeInterval: seconds, repeats: false) { [weak self] _ in
                guard let self = self else { return }
                self.stopSilenceInternal()
                self.playAlarmSoundInternal()
            }
        }

        let center = UNUserNotificationCenter.current()
        let allTimerIds = stagedTimerIds + [timerNotificationId]
        center.removePendingNotificationRequests(withIdentifiers: allTimerIds)
        center.removeDeliveredNotifications(withIdentifiers: allTimerIds)

        center.getNotificationSettings { [weak self] settings in
            guard let self = self else { return }
            if settings.authorizationStatus == .notDetermined {
                center.requestAuthorization(options: [.alert, .badge, .sound]) { granted, _ in
                    if granted {
                        self.scheduleStagedNotifications(seconds: seconds, title: title, body: body)
                        call.resolve(["status": "scheduled", "seconds": seconds])
                    } else {
                        call.resolve(["status": "permission_denied"])
                    }
                }
            } else if settings.authorizationStatus == .denied {
                call.resolve(["status": "permission_denied"])
            } else {
                self.scheduleStagedNotifications(seconds: seconds, title: title, body: body)
                call.resolve(["status": "scheduled", "seconds": seconds])
            }
        }
    }

    private func scheduleStagedNotifications(seconds: Double, title: String, body: String) {
        let center = UNUserNotificationCenter.current()
        let soundUrl = getAudioUrl(named: "bloom_alarm.wav")
        let sound = soundUrl != nil ? UNNotificationSound(named: UNNotificationSoundName("bloom_alarm.wav")) : .default

        for i in 0..<5 {
            let content = UNMutableNotificationContent()
            content.title = title
            content.body = body
            content.sound = sound
            if #available(iOS 15.0, *) {
                content.interruptionLevel = .timeSensitive
            }
            let trigger = UNTimeIntervalNotificationTrigger(timeInterval: max(1.0, seconds + Double(i)), repeats: false)
            let request = UNNotificationRequest(identifier: "bloom-timer-stage-\(i)", content: content, trigger: trigger)
            center.add(request) { error in
                if let error = error {
                    print("Error scheduling staged notification \(i): \(error)")
                }
            }
        }
    }

    @objc func cancelTimerNotification(_ call: CAPPluginCall) {
        nativeCountdownTimer?.invalidate()
        nativeCountdownTimer = nil
        stopSilenceInternal()
        stopAlarmSoundInternal()
        cleanupTimerNotifications()
        call.resolve(["status": "cancelled"])
    }

    private func cleanupTimerNotifications() {
        let center = UNUserNotificationCenter.current()
        let allTimerIds = stagedTimerIds + [timerNotificationId]
        center.removePendingNotificationRequests(withIdentifiers: allTimerIds)
        center.removeDeliveredNotifications(withIdentifiers: allTimerIds)
    }

    @objc func sendTest(_ call: CAPPluginCall) {
        let content = UNMutableNotificationContent()
        content.title = call.getString("title", "Bloom")
        content.body = call.getString("body", "Your gentle reminder is working.")
        content.sound = .default
        let request = UNNotificationRequest(identifier: "bloom-test-\(UUID().uuidString)", content: content, trigger: UNTimeIntervalNotificationTrigger(timeInterval: 1, repeats: false))
        UNUserNotificationCenter.current().add(request) { error in
            if let error = error {
                call.resolve(["error": error.localizedDescription])
            } else {
                call.resolve(["status": "sent"])
            }
        }
    }

    @objc func updateWidget(_ call: CAPPluginCall) {
        guard let defaults = UserDefaults(suiteName: suiteName) else {
            call.resolve(["error": "The Bloom widget app group is unavailable"])
            return
        }
        defaults.set(call.getString("name", ""), forKey: "name")
        defaults.set(call.getString("date", ""), forKey: "date")
        defaults.set(call.getInt("completed", 0), forKey: "completed")
        defaults.set(call.getInt("total", 0), forKey: "total")
        defaults.set(call.getInt("water", 0), forKey: "water")
        defaults.set(Date().timeIntervalSince1970, forKey: "updatedAt")
        if #available(iOS 14.0, *) {
            WidgetCenter.shared.reloadAllTimelines()
        }
        call.resolve(["status": "updated"])
    }
}
