export class DeviceRepository {
  constructor(database) {
    this.database = database;

    this.upsertDeviceStatement = database.prepare(`
      INSERT INTO devices (
        token,
        environment,
        alert_mode,
        sound_name,
        critical_volume,
        keyword_filter_mode,
        created_at,
        updated_at
      ) VALUES (
        @token,
        @environment,
        @alertMode,
        @soundName,
        @criticalVolume,
        @keywordFilterMode,
        @timestamp,
        @timestamp
      )
      ON CONFLICT(token) DO UPDATE SET
        environment = excluded.environment,
        alert_mode = excluded.alert_mode,
        sound_name = excluded.sound_name,
        critical_volume = excluded.critical_volume,
        keyword_filter_mode = excluded.keyword_filter_mode,
        updated_at = excluded.updated_at
    `);

    this.deleteRegionsByTokenStatement = database.prepare(
      'DELETE FROM device_regions WHERE token = ?',
    );
    this.insertRegionStatement = database.prepare(
      'INSERT INTO device_regions (token, region_code) VALUES (?, ?)',
    );

    this.deleteKeywordsByTokenStatement = database.prepare(
      'DELETE FROM device_keywords WHERE token = ?',
    );
    this.insertKeywordStatement = database.prepare(
      'INSERT INTO device_keywords (token, keyword, normalized_keyword) VALUES (?, ?, ?)',
    );

    this.deleteDeviceStatement = database.prepare('DELETE FROM devices WHERE token = ?');
    this.selectDeviceStatement = database.prepare(`
      SELECT
        token,
        environment,
        alert_mode AS alertMode,
        sound_name AS soundName,
        critical_volume AS criticalVolume,
        keyword_filter_mode AS keywordFilterMode,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM devices
      WHERE token = ?
    `);
    this.selectRegionsByTokenStatement = database.prepare(
      'SELECT region_code AS regionCode FROM device_regions WHERE token = ? ORDER BY region_code ASC',
    );
    this.selectKeywordsByTokenStatement = database.prepare(
      'SELECT keyword, normalized_keyword AS normalizedKeyword FROM device_keywords WHERE token = ? ORDER BY rowid ASC',
    );
    this.pingStatement = database.prepare('SELECT 1 AS ok');
  }

  ping() {
    const row = this.pingStatement.get();
    return row?.ok === 1;
  }

  upsertDevice(registration) {
    const timestamp = new Date().toISOString();

    this.database.exec('BEGIN IMMEDIATE');
    try {
      this.upsertDeviceStatement.run({
        token: registration.token,
        environment: registration.environment,
        alertMode: registration.alertMode,
        soundName: registration.soundName,
        criticalVolume: registration.criticalVolume,
        keywordFilterMode: registration.keywordFilterMode,
        timestamp,
      });

      this.deleteRegionsByTokenStatement.run(registration.token);
      for (const regionCode of registration.regionCodes) {
        this.insertRegionStatement.run(registration.token, regionCode);
      }

      this.deleteKeywordsByTokenStatement.run(registration.token);
      for (const keywordEntry of registration.keywords) {
        this.insertKeywordStatement.run(
          registration.token,
          keywordEntry.keyword,
          keywordEntry.normalizedKeyword,
        );
      }

      this.database.exec('COMMIT');
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  deleteDeviceByToken(token) {
    const statementResult = this.deleteDeviceStatement.run(token);
    return statementResult.changes > 0;
  }

  findDeviceByToken(token) {
    const deviceRow = this.selectDeviceStatement.get(token);
    if (!deviceRow) {
      return null;
    }
    return this.#hydrateDevice(deviceRow);
  }

  findDevicesByRegionCodes(regionCodes) {
    if (!Array.isArray(regionCodes) || regionCodes.length === 0) {
      return [];
    }

    const uniqueCodes = Array.from(new Set(regionCodes));
    const placeholders = uniqueCodes.map(() => '?').join(', ');
    const query = this.database.prepare(`
      SELECT DISTINCT
        d.token,
        d.environment,
        d.alert_mode AS alertMode,
        d.sound_name AS soundName,
        d.critical_volume AS criticalVolume,
        d.keyword_filter_mode AS keywordFilterMode,
        d.created_at AS createdAt,
        d.updated_at AS updatedAt
      FROM devices d
      INNER JOIN device_regions dr ON dr.token = d.token
      WHERE dr.region_code IN (${placeholders})
      ORDER BY d.token ASC
    `);

    const rows = query.all(...uniqueCodes);
    return rows.map((row) => this.#hydrateDevice(row));
  }

  #hydrateDevice(deviceRow) {
    const regionRows = this.selectRegionsByTokenStatement.all(deviceRow.token);
    const keywordRows = this.selectKeywordsByTokenStatement.all(deviceRow.token);

    return {
      token: deviceRow.token,
      environment: deviceRow.environment,
      regionCodes: regionRows.map((row) => row.regionCode),
      alertMode: deviceRow.alertMode,
      soundName: deviceRow.soundName,
      criticalVolume: deviceRow.criticalVolume ?? null,
      keywordFilterMode: deviceRow.keywordFilterMode,
      keywords: keywordRows.map((row) => ({
        keyword: row.keyword,
        normalizedKeyword: row.normalizedKeyword,
      })),
      createdAt: deviceRow.createdAt,
      updatedAt: deviceRow.updatedAt,
    };
  }
}
