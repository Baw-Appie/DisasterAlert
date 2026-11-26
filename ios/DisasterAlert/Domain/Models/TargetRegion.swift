import Foundation

public struct TargetRegion: Codable, Equatable, Hashable, Identifiable, Sendable {
    public let code: String
    public let provinceName: String
    public let districtName: String?
    public let neighborhoodName: String?

    public var id: String { code }

    public init(
        code: String,
        provinceName: String,
        districtName: String? = nil,
        neighborhoodName: String? = nil
    ) {
        self.code = code
        self.provinceName = provinceName
        self.districtName = districtName
        self.neighborhoodName = neighborhoodName
    }

    public var displayName: String {
        if let districtName, let neighborhoodName {
            return "\(provinceName) \(districtName) \(neighborhoodName)"
        }
        if let districtName {
            return "\(provinceName) \(districtName)"
        }
        return "\(provinceName) 전체"
    }
}
