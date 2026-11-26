import Foundation

public struct RegionCatalog: Codable, Equatable, Sendable {
    public let source: String
    public let provinces: [ProvinceNode]

    public init(source: String, provinces: [ProvinceNode]) {
        self.source = source
        self.provinces = provinces
    }
}

public struct ProvinceNode: Codable, Equatable, Hashable, Identifiable, Sendable {
    public let code: String
    public let name: String
    public let districts: [DistrictNode]

    public var id: String { code }

    public init(code: String, name: String, districts: [DistrictNode]) {
        self.code = code
        self.name = name
        self.districts = districts
    }
}

public struct DistrictNode: Codable, Equatable, Hashable, Identifiable, Sendable {
    public let code: String
    public let name: String
    public let neighborhoods: [NeighborhoodNode]

    public var id: String { code }

    public init(code: String, name: String, neighborhoods: [NeighborhoodNode]) {
        self.code = code
        self.name = name
        self.neighborhoods = neighborhoods
    }
}

public struct NeighborhoodNode: Codable, Equatable, Hashable, Identifiable, Sendable {
    public let code: String
    public let name: String

    public var id: String { code }

    public init(code: String, name: String) {
        self.code = code
        self.name = name
    }
}
