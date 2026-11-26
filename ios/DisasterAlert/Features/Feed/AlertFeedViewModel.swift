import Foundation
import Observation

@Observable
@MainActor
final class AlertFeedViewModel {
    private(set) var allAlerts: [DisasterAlert] = []
    private(set) var isLoading = false
    private(set) var errorMessage: String?
    var isLocationPermissionDenied = false

    private let alertRepository: AlertRepositoryProtocol
    private let filterService: AlertFilterService

    init(
        alertRepository: AlertRepositoryProtocol,
        filterService: AlertFilterService = AlertFilterService()
    ) {
        self.alertRepository = alertRepository
        self.filterService = filterService
    }

    func loadAlerts() async {
        isLoading = true
        errorMessage = nil

        do {
            let fetchedAlerts = try await alertRepository.fetchRecentAlerts()
            allAlerts = fetchedAlerts
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    func filteredAlerts(using rule: AlertFilterRule) -> [DisasterAlert] {
        filterService.filterAlerts(allAlerts, using: rule)
    }

    func matchedKeywords(
        for alert: DisasterAlert,
        using rule: AlertFilterRule
    ) -> [IncludeKeyword] {
        guard rule.keywordFilterMode == .includeOnly || rule.keywordFilterMode == .includeAndExclude else {
            return []
        }
        return filterService.matchedIncludeKeywords(for: alert, in: rule.includeKeywords)
    }

    func viewState(for filteredList: [DisasterAlert], rule: AlertFilterRule) -> FeedViewState {
        if isLoading && allAlerts.isEmpty {
            return .loading
        }
        if let errorMessage {
            return .error(message: errorMessage)
        }
        if isLocationPermissionDenied {
            return .permissionDenied
        }
        if filteredList.isEmpty {
            let emptyReason: EmptyFeedReason = rule.isAlertEnabled ? .noMatchingAlerts : .alertsMuted
            return .empty(reason: emptyReason)
        }
        return .loaded
    }
}
