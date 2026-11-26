import Foundation

public struct DisasterAlert: Codable, Equatable, Hashable, Identifiable, Sendable {
    public let id: String
    public let category: DisasterCategory
    public let severity: SeverityLevel
    public let message: String
    public let targetRegions: [TargetRegion]
    public let issuedAt: Date
    public let senderName: String
    public let actionGuidelines: [String]

    public init(
        id: String,
        category: DisasterCategory,
        severity: SeverityLevel,
        message: String,
        targetRegions: [TargetRegion],
        issuedAt: Date,
        senderName: String,
        actionGuidelines: [String] = []
    ) {
        self.id = id
        self.category = category
        self.severity = severity
        self.message = message
        self.targetRegions = targetRegions
        self.issuedAt = issuedAt
        self.senderName = senderName
        self.actionGuidelines = actionGuidelines
    }

    public var primaryRegionSummary: String {
        guard let firstRegion = targetRegions.first else {
            return "전국"
        }
        if targetRegions.count == 1 {
            return firstRegion.displayName
        }
        return "\(firstRegion.displayName) 외 \(targetRegions.count - 1)곳"
    }
}
