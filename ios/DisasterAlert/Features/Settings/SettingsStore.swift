import Foundation
import Observation

@Observable
@MainActor
public final class SettingsStore {
    public var rule: AlertFilterRule {
        didSet {
            repository.saveRule(rule)
        }
    }

    private let repository: SettingsRepositoryProtocol

    public init(repository: SettingsRepositoryProtocol) {
        self.repository = repository
        self.rule = repository.loadRule()
    }

    public var regionSummaryText: String {
        guard let firstRegion = rule.subscribedRegions.first else {
            return "전체 지역"
        }
        if rule.subscribedRegions.count == 1 {
            return firstRegion.displayName
        }
        return "\(firstRegion.displayName) 외 \(rule.subscribedRegions.count - 1)곳"
    }

    public func isRegionSubscribed(code: String) -> Bool {
        rule.subscribedRegions.contains { $0.code == code }
    }

    public func addRegion(_ region: SubscribedRegion) {
        guard !isRegionSubscribed(code: region.code) else {
            return
        }
        rule.subscribedRegions.append(region)
    }

    public func removeRegions(at offsets: IndexSet) {
        for index in offsets.sorted(by: >) {
            rule.subscribedRegions.remove(at: index)
        }
    }

    public func removeRegion(_ region: SubscribedRegion) {
        rule.subscribedRegions.removeAll { $0.code == region.code }
    }

    @discardableResult
    public func addIncludeKeyword(_ rawText: String) -> Bool {
        let keyword = IncludeKeyword(value: rawText)
        guard !keyword.value.isEmpty,
              !rule.includeKeywords.contains(where: { $0.id == keyword.id }) else {
            return false
        }
        rule.includeKeywords.append(keyword)
        return true
    }

    public func removeIncludeKeyword(_ keyword: IncludeKeyword) {
        rule.includeKeywords.removeAll { $0.id == keyword.id }
    }

    public func removeIncludeKeywords(at offsets: IndexSet) {
        for index in offsets.sorted(by: >) {
            rule.includeKeywords.remove(at: index)
        }
    }

    @discardableResult
    public func addExcludeKeyword(_ rawText: String) -> Bool {
        let keyword = ExcludeKeyword(value: rawText)
        guard !keyword.value.isEmpty,
              !rule.excludeKeywords.contains(where: { $0.id == keyword.id }) else {
            return false
        }
        rule.excludeKeywords.append(keyword)
        return true
    }

    public func removeExcludeKeyword(_ keyword: ExcludeKeyword) {
        rule.excludeKeywords.removeAll { $0.id == keyword.id }
    }

    public func removeExcludeKeywords(at offsets: IndexSet) {
        for index in offsets.sorted(by: >) {
            rule.excludeKeywords.remove(at: index)
        }
    }
}
