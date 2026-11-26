import Foundation

public struct AlertFilterService: Sendable {
    public init() {}

    public func filterAlerts(
        _ alerts: [DisasterAlert],
        using rule: AlertFilterRule
    ) -> [DisasterAlert] {
        alerts
            .filter { shouldDisplayAlert($0, using: rule) }
            .sorted { $0.issuedAt > $1.issuedAt }
    }

    public func shouldDisplayAlert(
        _ alert: DisasterAlert,
        using rule: AlertFilterRule
    ) -> Bool {
        if rule.isEmergencyOverrideEnabled && alert.severity == .emergency {
            return true
        }

        guard rule.isAlertEnabled else {
            return false
        }

        guard matchesSubscribedRegions(alert.targetRegions, subscribedRegions: rule.subscribedRegions) else {
            return false
        }

        return matchesKeywordRule(alert, using: rule)
    }

    public func matchedIncludeKeywords(
        for alert: DisasterAlert,
        in includeKeywords: [IncludeKeyword]
    ) -> [IncludeKeyword] {
        let searchableText = searchableContent(for: alert)
        return includeKeywords.filter { keyword in
            !keyword.value.isEmpty && searchableText.localizedCaseInsensitiveContains(keyword.value)
        }
    }

    public func matchesSubscribedRegions(
        _ targetRegions: [TargetRegion],
        subscribedRegions: [SubscribedRegion]
    ) -> Bool {
        guard !subscribedRegions.isEmpty else {
            return true
        }

        return targetRegions.contains { target in
            subscribedRegions.contains { subscribed in
                regionsOverlap(target: target, subscribed: subscribed)
            }
        }
    }

    private func regionsOverlap(
        target: TargetRegion,
        subscribed: SubscribedRegion
    ) -> Bool {
        guard target.provinceName == subscribed.provinceName else {
            return false
        }

        guard let targetDistrict = target.districtName,
              let subscribedDistrict = subscribed.districtName else {
            return true
        }

        guard targetDistrict == subscribedDistrict else {
            return false
        }

        guard let targetNeighborhood = target.neighborhoodName,
              let subscribedNeighborhood = subscribed.neighborhoodName else {
            return true
        }

        return targetNeighborhood == subscribedNeighborhood
    }

    private func matchesKeywordRule(
        _ alert: DisasterAlert,
        using rule: AlertFilterRule
    ) -> Bool {
        let searchableText = searchableContent(for: alert)
        let hasIncludeMatch = rule.includeKeywords.contains { keyword in
            !keyword.value.isEmpty && searchableText.localizedCaseInsensitiveContains(keyword.value)
        }
        let hasExcludeMatch = rule.excludeKeywords.contains { keyword in
            !keyword.value.isEmpty && searchableText.localizedCaseInsensitiveContains(keyword.value)
        }

        switch rule.keywordFilterMode {
        case .disabled:
            return true

        case .excludeMatching:
            return !hasExcludeMatch

        case .includeOnly:
            guard !rule.includeKeywords.isEmpty else {
                return true
            }
            return hasIncludeMatch

        case .includeAndExclude:
            // 핵심 도메인 정책: 포함 키워드와 제외 키워드 동시 매칭 시 반드시 포함 키워드 우선
            if hasIncludeMatch {
                return true
            }
            if hasExcludeMatch {
                return false
            }
            return true
        }
    }

    private func searchableContent(for alert: DisasterAlert) -> String {
        "\(alert.category.displayName) \(alert.severity.displayName) \(alert.message)"
    }
}
