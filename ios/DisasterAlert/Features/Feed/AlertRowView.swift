import SwiftUI

struct AlertRowView: View {
    let alert: DisasterAlert
    let matchedKeywords: [IncludeKeyword]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .center, spacing: 8) {
                AlertCategoryLabel(category: alert.category, severity: alert.severity)
                AlertSeverityBadge(severity: alert.severity)

                if let firstKeyword = matchedKeywords.first {
                    Text("#\(firstKeyword.value)")
                        .font(.caption2.weight(.medium))
                        .foregroundStyle(.green)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.green.opacity(0.12), in: Capsule())
                }

                Spacer()
            }

            Text(alert.message)
                .font(.body)
                .foregroundStyle(.primary)
                .lineLimit(3)

            HStack(spacing: 12) {
                Label(alert.primaryRegionSummary, systemImage: "mappin.and.ellipse")
                    .lineLimit(1)

                Spacer(minLength: 4)

                Text(AlertDateFormatter.listString(from: alert.issuedAt))
                    .monospacedDigit()
            }
            .font(.caption)
            .foregroundStyle(.secondary)
        }
        .padding(.vertical, 4)
    }
}
