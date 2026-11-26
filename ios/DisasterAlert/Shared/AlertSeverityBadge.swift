import SwiftUI

struct AlertSeverityBadge: View {
    let severity: SeverityLevel

    var body: some View {
        Text(severity.displayName)
            .font(.caption2.weight(.semibold))
            .foregroundStyle(badgeColor)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(badgeColor.opacity(0.14), in: Capsule())
    }

    private var badgeColor: Color {
        switch severity {
        case .emergency:
            return .red
        case .urgent:
            return .orange
        case .safety:
            return .blue
        }
    }
}

struct AlertCategoryLabel: View {
    let category: DisasterCategory
    let severity: SeverityLevel

    var body: some View {
        Label(category.displayName, systemImage: category.symbolName)
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(iconColor)
    }

    private var iconColor: Color {
        switch severity {
        case .emergency:
            return .red
        case .urgent:
            return .orange
        case .safety:
            return .primary
        }
    }
}
