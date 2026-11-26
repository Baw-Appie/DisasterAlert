import Foundation

public struct AlertFilterRule: Codable, Equatable, Sendable {
    public var isAlertEnabled: Bool
    public var subscribedRegions: [SubscribedRegion]
    public var isEmergencyOverrideEnabled: Bool
    public var keywordFilterMode: KeywordFilterMode
    public var includeKeywords: [IncludeKeyword]
    public var excludeKeywords: [ExcludeKeyword]

    public init(
        isAlertEnabled: Bool = true,
        subscribedRegions: [SubscribedRegion] = [],
        isEmergencyOverrideEnabled: Bool = true,
        keywordFilterMode: KeywordFilterMode = .disabled,
        includeKeywords: [IncludeKeyword] = [],
        excludeKeywords: [ExcludeKeyword] = []
    ) {
        self.isAlertEnabled = isAlertEnabled
        self.subscribedRegions = subscribedRegions
        self.isEmergencyOverrideEnabled = isEmergencyOverrideEnabled
        self.keywordFilterMode = keywordFilterMode
        self.includeKeywords = includeKeywords
        self.excludeKeywords = excludeKeywords
    }
}
