import Foundation

public enum KeywordFilterMode: String, Codable, CaseIterable, Identifiable, Sendable {
    case disabled
    case excludeMatching
    case includeOnly
    case includeAndExclude

    public var id: String { rawValue }

    public var displayName: String {
        switch self {
        case .disabled:
            return "키워드 필터 사용 안함"
        case .excludeMatching:
            return "해당 키워드가 포함된 알림 제외"
        case .includeOnly:
            return "해당 키워드가 포함된 알림만 받기"
        case .includeAndExclude:
            return "포함·제외 키워드 함께 사용 (포함 우선)"
        }
    }

    public var shortSummary: String {
        switch self {
        case .disabled:
            return "사용 안함"
        case .excludeMatching:
            return "키워드 제외"
        case .includeOnly:
            return "포함 알림만"
        case .includeAndExclude:
            return "포함 우선 복합"
        }
    }
}

public struct IncludeKeyword: Codable, Equatable, Hashable, Identifiable, Sendable {
    public let value: String

    public var id: String { value.lowercased() }

    public init(value: String) {
        self.value = value.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

public struct ExcludeKeyword: Codable, Equatable, Hashable, Identifiable, Sendable {
    public let value: String

    public var id: String { value.lowercased() }

    public init(value: String) {
        self.value = value.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
