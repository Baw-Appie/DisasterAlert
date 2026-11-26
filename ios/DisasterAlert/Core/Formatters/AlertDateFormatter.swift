import Foundation

public enum AlertDateFormatter {
    private static let listFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.timeZone = TimeZone(identifier: "Asia/Seoul") ?? .current
        formatter.dateFormat = "yyyy.MM.dd HH:mm"
        return formatter
    }()

    private static let detailFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.timeZone = TimeZone(identifier: "Asia/Seoul") ?? .current
        formatter.dateFormat = "yyyy년 M월 d일 (E) HH:mm:ss"
        return formatter
    }()

    public static func listString(from date: Date) -> String {
        listFormatter.string(from: date)
    }

    public static func detailString(from date: Date) -> String {
        detailFormatter.string(from: date)
    }
}
