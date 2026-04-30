export interface BusArrival {
  line: string;
  destination: string;
  minutes: number | null;
}

export interface StopConnection {
  line: string;
  color: string;
  desc: string;
  type: string;
}

export interface BusLine {
  CODI_LINIA: number;
  NOM_LINIA: string;
  DESC_LINIA: string;
  ORIGEN_LINIA: string;
  DESTI_LINIA: string;
  COLOR_LINIA?: string;
}

export interface BusStop {
  CODI_PARADA: number;
  NOM_PARADA: string;
  SENTIT: string;
  ORDRE: number;
}
