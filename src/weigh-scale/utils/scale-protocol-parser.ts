export interface ParsedScaleResult {
  raw: string;
  weight: number;
  unit: string;
  isStable: boolean;
  protocol: string;
}

export class ScaleProtocolParser {
  /**
   * Parses raw ASCII buffer strings sent by direct USB/Serial COM port scales.
   *
   * Supported Protocols:
   * - CAS: "ST,GS,+  001.500kg" or "US,GS,+  001.500kg"
   * - NCI: "\r001.500KG\r" or "\r  1.500LB\r\n"
   * - TOLEDO (Mettler Toledo SICS): "S S 1.500 kg" or "S D 1.500 kg"
   * - DIBAL / GENERIC ASCII: Any string containing float numbers "1.500 kg" or "+001.500"
   */
  static parseRawScaleString(
    rawData: string,
    protocol = 'CAS',
  ): ParsedScaleResult {
    const raw = rawData ? rawData.trim() : '';
    let weight = 0;
    let unit = 'KG';
    let isStable = true;
    const proto = (protocol || 'CAS').toUpperCase();

    if (!raw) {
      return { raw: '', weight: 0, unit: 'KG', isStable: false, protocol: proto };
    }

    // 1. CAS Protocol (e.g., "ST,GS,+  1.500kg" or "US,GS,+  001.500kg")
    if (proto === 'CAS' || raw.includes('ST,GS') || raw.includes('US,GS')) {
      if (raw.includes('US,GS')) {
        isStable = false;
      }

      if (raw.toLowerCase().includes('lb')) {
        unit = 'LB';
      } else if (raw.toLowerCase().includes('oz')) {
        unit = 'OZ';
      } else if (raw.toLowerCase().includes('g') && !raw.toLowerCase().includes('kg')) {
        unit = 'G';
      } else {
        unit = 'KG';
      }

      const match = raw.match(/[-+]?\s*(\d+\.?\d*)/);
      if (match) {
        weight = parseFloat(match[1]) || 0;
      }

      return { raw, weight, unit, isStable, protocol: 'CAS' };
    }

    // 2. Mettler Toledo SICS Protocol (e.g., "S S 1.500 kg" or "S D 1.500 kg")
    if (proto === 'TOLEDO' || raw.startsWith('S S') || raw.startsWith('S D')) {
      if (raw.startsWith('S D')) {
        isStable = false;
      }

      const match = raw.match(/(\d+\.?\d*)\s*([a-zA-Z]+)?/);
      if (match) {
        weight = parseFloat(match[1]) || 0;
        if (match[2]) unit = match[2].toUpperCase();
      }

      return { raw, weight, unit, isStable, protocol: 'TOLEDO' };
    }

    // 3. NCI / Avery Weigh-Tronix Protocol (e.g., "\r001.500KG\r")
    if (proto === 'NCI' || /^\r?\s*(\d+\.?\d*)\s*([a-zA-Z]+)?\r?$/.test(raw)) {
      if (raw.toLowerCase().includes('lb')) unit = 'LB';
      else if (raw.toLowerCase().includes('oz')) unit = 'OZ';

      const match = raw.match(/(\d+\.?\d*)/);
      if (match) {
        weight = parseFloat(match[1]) || 0;
      }

      return { raw, weight, unit, isStable, protocol: 'NCI' };
    }

    // 4. Fallback Generic ASCII Parser
    const genericMatch = raw.match(/[-+]?\s*(\d+\.?\d*)/);
    if (genericMatch) {
      weight = parseFloat(genericMatch[1]) || 0;
    }

    if (raw.toLowerCase().includes('lb')) unit = 'LB';
    else if (raw.toLowerCase().includes('oz')) unit = 'OZ';
    else if (raw.toLowerCase().includes('g') && !raw.toLowerCase().includes('kg')) unit = 'G';

    return { raw, weight, unit, isStable, protocol: proto };
  }
}
