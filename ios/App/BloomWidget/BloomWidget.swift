import SwiftUI
import WidgetKit

private let bloomSuite = "group.app.bloom.routine"

struct BloomEntry: TimelineEntry {
    let date: Date
    let name: String
    let completed: Int
    let total: Int
    let water: Int
}

struct BloomProvider: TimelineProvider {
    func placeholder(in context: Context) -> BloomEntry {
        BloomEntry(date: Date(), name: "", completed: 3, total: 7, water: 4)
    }

    func getSnapshot(in context: Context, completion: @escaping (BloomEntry) -> Void) {
        completion(entry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<BloomEntry>) -> Void) {
        let current = entry()
        let refresh = Calendar.current.date(byAdding: .minute, value: 30, to: Date()) ?? Date().addingTimeInterval(1800)
        completion(Timeline(entries: [current], policy: .after(refresh)))
    }

    private func entry() -> BloomEntry {
        let defaults = UserDefaults(suiteName: bloomSuite)
        return BloomEntry(
            date: Date(),
            name: defaults?.string(forKey: "name") ?? "",
            completed: defaults?.integer(forKey: "completed") ?? 0,
            total: defaults?.integer(forKey: "total") ?? 0,
            water: defaults?.integer(forKey: "water") ?? 0
        )
    }
}

struct BloomWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: BloomEntry

    private var progress: Double {
        entry.total > 0 ? min(1, Double(entry.completed) / Double(entry.total)) : 0
    }

    var body: some View {
        ZStack {
            Color(red: 0.96, green: 0.97, blue: 0.93)
            Circle()
                .fill(Color(red: 0.25, green: 0.88, blue: 0.82).opacity(0.14))
                .frame(width: 150, height: 150)
                .offset(x: 75, y: -70)
            VStack(alignment: .leading, spacing: family == .systemSmall ? 8 : 10) {
                HStack {
                    Text("bloom.")
                        .font(.system(size: 15, weight: .bold, design: .rounded))
                        .foregroundColor(Color(red: 0.17, green: 0.28, blue: 0.21))
                    Spacer()
                    Image(systemName: "sparkles")
                        .foregroundColor(Color(red: 0.32, green: 0.55, blue: 0.36))
                }
                if family == .systemSmall {
                    Text("\(entry.completed) of \(entry.total)")
                        .font(.system(size: 27, weight: .medium, design: .serif))
                        .foregroundColor(Color(red: 0.17, green: 0.28, blue: 0.21))
                    Text("little things done")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                } else {
                    Text(entry.name.isEmpty ? "Today’s gentle rhythm" : "\(entry.name)’s gentle rhythm")
                        .font(.system(size: 20, weight: .medium, design: .serif))
                        .foregroundColor(Color(red: 0.17, green: 0.28, blue: 0.21))
                    HStack(spacing: 18) {
                        Label("\(entry.completed)/\(entry.total) done", systemImage: "checkmark.circle.fill")
                        Label("\(entry.water)/8 water", systemImage: "drop.fill")
                    }
                    .font(.caption)
                    .foregroundColor(Color(red: 0.28, green: 0.43, blue: 0.31))
                }
                GeometryReader { proxy in
                    ZStack(alignment: .leading) {
                        Capsule().fill(Color.black.opacity(0.07))
                        Capsule().fill(Color(red: 0.43, green: 0.59, blue: 0.44)).frame(width: proxy.size.width * progress)
                    }
                }
                .frame(height: 6)
                Text(entry.completed == entry.total && entry.total > 0 ? "You flourished today." : "A little progress counts.")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
            .padding(16)
        }
        .widgetURL(URL(string: "bloom://today"))
    }
}

@main
struct BloomWidget: Widget {
    let kind = "BloomWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: BloomProvider()) { entry in
            BloomWidgetView(entry: entry)
        }
        .configurationDisplayName("Today in Bloom")
        .description("See routine and hydration progress at a glance.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
