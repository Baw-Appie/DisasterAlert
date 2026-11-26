import Foundation

public enum RegionCatalogError: LocalizedError {
    case resourceNotFound
    case decodingFailed

    public var errorDescription: String? {
        switch self {
        case .resourceNotFound:
            return "법정동 지역 데이터를 찾을 수 없습니다."
        case .decodingFailed:
            return "법정동 지역 데이터를 불러오는 중 오류가 발생했습니다."
        }
    }
}

public protocol RegionCatalogProviding: Sendable {
    func loadCatalog() throws -> RegionCatalog
}

public final class RegionCatalogRepository: RegionCatalogProviding, @unchecked Sendable {
    private let bundle: Bundle
    private let lock = NSLock()
    private var cachedCatalog: RegionCatalog?

    public init(bundle: Bundle = .main) {
        self.bundle = bundle
    }

    public func loadCatalog() throws -> RegionCatalog {
        lock.lock()
        if let cachedCatalog {
            lock.unlock()
            return cachedCatalog
        }
        lock.unlock()

        guard let fileURL = bundle.url(forResource: "Regions", withExtension: "json") else {
            throw RegionCatalogError.resourceNotFound
        }

        let jsonBytes: Data
        do {
            jsonBytes = try Data(contentsOf: fileURL)
        } catch {
            throw RegionCatalogError.resourceNotFound
        }

        do {
            let catalog = try JSONDecoder().decode(RegionCatalog.self, from: jsonBytes)
            lock.lock()
            cachedCatalog = catalog
            lock.unlock()
            return catalog
        } catch {
            throw RegionCatalogError.decodingFailed
        }
    }
}
