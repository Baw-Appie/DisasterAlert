import Foundation

public enum SeverityLevel: String, Codable, CaseIterable, Identifiable, Sendable {
    case emergency
    case urgent
    case safety

    public var id: String { rawValue }

    public var displayName: String {
        switch self {
        case .emergency:
            return "위급재난"
        case .urgent:
            return "긴급재난"
        case .safety:
            return "안전안내"
        }
    }

    public var priorityRank: Int {
        switch self {
        case .emergency:
            return 3
        case .urgent:
            return 2
        case .safety:
            return 1
        }
    }
}
