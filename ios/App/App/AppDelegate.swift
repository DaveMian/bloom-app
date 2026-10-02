import UIKit
import Capacitor
import UserNotifications
import WidgetKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate, UNUserNotificationCenterDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
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

@objc(ViewController)
public class ViewController: CAPBridgeViewController {
    override public func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(BloomNativePlugin())
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
        CAPPluginMethod(name: "updateWidget", returnType: CAPPluginReturnPromise)
    ]

    private let hydrationIds = (0...23).map { "bloom-hydration-\($0)" }
    private let eveningId = "bloom-evening-summary"
    private let suiteName = "group.app.bloom.routine"

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
        call.resolve(["scheduled": scheduled])
    }

    @objc func cancelReminders(_ call: CAPPluginCall) {
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: hydrationIds + [eveningId])
        call.resolve()
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
