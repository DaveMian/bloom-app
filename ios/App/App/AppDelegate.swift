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
        completionHandler([.banner, .sound])
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default Configuration",
                                          sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }
}

final class BloomBridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(BloomNativePlugin())
    }
}

@objc(BloomNativePlugin)
public class BloomNativePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "BloomNativePlugin"
    public let jsName = "BloomNative"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "requestPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "scheduleReminders", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancelReminders", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "sendTest", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "updateWidget", returnType: CAPPluginReturnPromise)
    ]

    private let hydrationIds = (0...23).map { "bloom-hydration-\($0)" }
    private let eveningId = "bloom-evening-summary"
    private let suiteName = "group.app.bloom.routine"

    @objc func requestPermissions(_ call: CAPPluginCall) {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { granted, error in
            if let error = error {
                call.reject("Could not request notification permission", nil, error)
                return
            }
            call.resolve(["display": granted ? "granted" : "denied"])
        }
    }

    @objc func scheduleReminders(_ call: CAPPluginCall) {
        let interval = max(1, min(6, call.getInt("intervalHours") ?? 2))
        let startHour = max(0, min(23, call.getInt("startHour") ?? 9))
        let endHour = max(startHour, min(23, call.getInt("endHour") ?? 21))
        let eveningEnabled = call.getBool("eveningEnabled") ?? true
        let eveningHour = max(0, min(23, call.getInt("eveningHour") ?? 20))
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
            date.timeZone = TimeZone(identifier: "Asia/Dubai")
            date.hour = hour
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
            date.timeZone = TimeZone(identifier: "Asia/Dubai")
            date.hour = eveningHour
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
        content.title = call.getString("title") ?? "Bloom"
        content.body = call.getString("body") ?? "Your gentle reminder is working."
        content.sound = .default
        let request = UNNotificationRequest(identifier: "bloom-test-\(UUID().uuidString)", content: content, trigger: UNTimeIntervalNotificationTrigger(timeInterval: 1, repeats: false))
        UNUserNotificationCenter.current().add(request) { error in
            if let error = error {
                call.reject("Could not send the test reminder", nil, error)
            } else {
                call.resolve()
            }
        }
    }

    @objc func updateWidget(_ call: CAPPluginCall) {
        guard let defaults = UserDefaults(suiteName: suiteName) else {
            call.reject("The Bloom widget app group is unavailable")
            return
        }
        defaults.set(call.getString("name") ?? "", forKey: "name")
        defaults.set(call.getString("date") ?? "", forKey: "date")
        defaults.set(call.getInt("completed") ?? 0, forKey: "completed")
        defaults.set(call.getInt("total") ?? 0, forKey: "total")
        defaults.set(call.getInt("water") ?? 0, forKey: "water")
        defaults.set(Date().timeIntervalSince1970, forKey: "updatedAt")
        if #available(iOS 14.0, *) {
            WidgetCenter.shared.reloadAllTimelines()
        }
        call.resolve()
    }
}
