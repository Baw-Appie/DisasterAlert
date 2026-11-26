import SwiftUI

enum FeedViewState: Equatable {
    case loading
    case loaded
    case empty(reason: EmptyFeedReason)
    case permissionDenied
    case error(message: String)
}

enum EmptyFeedReason: Equatable {
    case alertsMuted
    case noMatchingAlerts
}

struct FeedStateView: View {
    let state: FeedViewState
    let onRetry: () -> Void
    let onOpenSettings: () -> Void

    var body: some View {
        switch state {
        case .loading:
            ProgressView("안전 알림 기록을 불러오는 중입니다...")
                .frame(maxWidth: .infinity, maxHeight: .infinity)

        case .loaded:
            EmptyView()

        case .empty(let reason):
            switch reason {
            case .alertsMuted:
                ContentUnavailableView {
                    Label("재난알림받기가 꺼져 있습니다", systemImage: "bell.slash")
                } description: {
                    Text("설정에서 '재난알림받기'를 켜면 선택한 지역과 키워드 조건에 맞는 알림을 확인할 수 있습니다.")
                } actions: {
                    Button("설정 열기", action: onOpenSettings)
                        .buttonStyle(.borderedProminent)
                }

            case .noMatchingAlerts:
                ContentUnavailableView {
                    Label("조건에 맞는 안전 알림이 없습니다", systemImage: "tray")
                } description: {
                    Text("설정한 알림 지역 또는 키워드 필터에 해당하는 안전 알림 기록이 없습니다.")
                } actions: {
                    Button("필터 설정 변경", action: onOpenSettings)
                        .buttonStyle(.bordered)
                }
            }

        case .permissionDenied:
            ContentUnavailableView {
                Label("위치 권한이 거부되어 있습니다", systemImage: "location.slash")
            } description: {
                Text("현재 위치 기반 알림을 확인하려면 기기 설정에서 위치 접근 권한을 허용하거나 관심 지역을 직접 설정해주세요.")
            } actions: {
                Button("관심 지역 설정하기", action: onOpenSettings)
                    .buttonStyle(.borderedProminent)
            }

        case .error(let message):
            ContentUnavailableView {
                Label("알림을 불러오지 못했습니다", systemImage: "wifi.exclamationmark")
            } description: {
                Text(message)
            } actions: {
                Button("다시 시도", action: onRetry)
                    .buttonStyle(.borderedProminent)
            }
        }
    }
}
