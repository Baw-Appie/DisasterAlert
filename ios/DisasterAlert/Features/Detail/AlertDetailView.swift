import SwiftUI

struct AlertDetailView: View {
    let alert: DisasterAlert

    var body: some View {
        List {
            Section("알림 내용") {
                VStack(alignment: .leading, spacing: 12) {
                    HStack(spacing: 8) {
                        AlertCategoryLabel(category: alert.category, severity: alert.severity)
                        AlertSeverityBadge(severity: alert.severity)
                        Spacer()
                    }

                    Text(alert.message)
                        .font(.body)
                        .lineSpacing(4)
                        .textSelection(.enabled)
                }
                .padding(.vertical, 4)
            }

            Section("수신 지역 (\(alert.targetRegions.count)곳)") {
                if alert.targetRegions.isEmpty {
                    Text("전국")
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(alert.targetRegions) { region in
                        HStack {
                            Label(region.displayName, systemImage: "mappin.circle.fill")
                            Spacer()
                            Text(region.code)
                                .font(.caption.monospacedDigit())
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }

            Section("상세 정보") {
                LabeledContent("알림 유형", value: alert.category.displayName)
                LabeledContent("긴급 등급", value: alert.severity.displayName)
                LabeledContent("알림 시간", value: AlertDateFormatter.detailString(from: alert.issuedAt))
                LabeledContent("발송 기관", value: alert.senderName)
                LabeledContent("문서 번호", value: alert.id)
            }

            if !alert.actionGuidelines.isEmpty {
                Section("행동 요령 및 참고 사항") {
                    ForEach(alert.actionGuidelines, id: \.self) { guideline in
                        Label(guideline, systemImage: "checkmark.shield")
                            .font(.subheadline)
                    }
                }
            }
        }
        .navigationTitle("안전 알림 상세")
        .navigationBarTitleDisplayMode(.inline)
    }
}
