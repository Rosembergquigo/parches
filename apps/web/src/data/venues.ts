import type { Sport } from './mock';

export type VenueKind = 'stadium' | 'court' | 'complex' | 'indoor';

export interface VenueContact {
  name: string;
  role?: string;
  phone: string;
  email?: string;
  whatsapp?: string;
}

export interface Venue {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  kind: VenueKind;
  sports: Sport[];
  city: string;
  neighborhood?: string;
  address: string;
  howToArrive?: string;
  description: string;
  surface?: string;
  capacity?: number;
  coverImageUrl: string;
  imageUrls: string[];
  lat?: number;
  lng?: number;
  contact: VenueContact;
  featured?: boolean;
}

export const VENUE_KIND_LABEL: Record<VenueKind, string> = {
  stadium: 'Estadio',
  court: 'Cancha',
  complex: 'Complejo',
  indoor: 'Coliseo',
};

export const VENUE_SPORT_LABEL: Record<string, string> = {
  football: 'Fútbol',
  basketball: 'Baloncesto',
  tennis: 'Tenis',
  volleyball: 'Voleibol',
  baseball: 'Béisbol',
  hockey: 'Hockey',
  motor: 'Motor',
  padel: 'Pádel',
  eSports: 'eSports',
  boxeo: 'Boxeo',
};

export const MOCK_VENUES: Venue[] = [
  {
    id: 'v-campin',
    slug: 'estadio-el-campin',
    name: 'Estadio Nemesio Camacho El Campín',
    shortName: 'El Campín',
    kind: 'stadium',
    sports: ['football'],
    city: 'Bogotá',
    neighborhood: 'Teusaquillo',
    address: 'Carrera 30 # 57-60',
    howToArrive: 'TransMilenio: estaciones Movistar Arena o Campín. Acceso peatonal por la Carrera 30.',
    description: 'Estadio emblemático de Bogotá. Césped natural, camerinos y anillo de palcos. Sede habitual de finales y clásicos de fútbol.',
    surface: 'Césped natural',
    capacity: 36343,
    coverImageUrl: 'https://images.unsplash.com/photo-1577223625816-7546f13df25d?auto=format&fit=crop&w=1600&q=80',
    imageUrls: [
      'https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1489944440615-453fc2b6a9a9?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?auto=format&fit=crop&w=1200&q=80',
    ],
    lat: 4.6459,
    lng: -74.0774,
    contact: {
      name: 'Oficina de eventos',
      role: 'Reservas',
      phone: '+57 601 335 0000',
      email: 'eventos@elcampin.demo',
      whatsapp: '573001112233',
    },
    featured: true,
  },
  {
    id: 'v-coliseo-campin',
    slug: 'coliseo-el-campin',
    name: 'Coliseo El Campín',
    shortName: 'Coliseo Campín',
    kind: 'indoor',
    sports: ['basketball'],
    city: 'Bogotá',
    neighborhood: 'Teusaquillo',
    address: 'Calle 57 # 30-20',
    howToArrive: 'Junto al estadio. Entrada por Calle 57. Parqueadero limitado los días de partido.',
    description: 'Coliseo cubierto con tablero central, gradería y cabina de transmisión. Pensado para ligas de baloncesto y eventos indoor.',
    surface: 'Parquet',
    capacity: 2500,
    coverImageUrl: 'https://images.unsplash.com/photo-1504450758481-7338eba7524a?auto=format&fit=crop&w=1600&q=80',
    imageUrls: [
      'https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1519861531473-9200262188bf?auto=format&fit=crop&w=1200&q=80',
    ],
    lat: 4.6474,
    lng: -74.0788,
    contact: {
      name: 'Andrea Ríos',
      role: 'Coordinación',
      phone: '+57 601 335 0101',
      email: 'coliseo@elcampin.demo',
    },
    featured: true,
  },
  {
    id: 'v-tenis-simon',
    slug: 'complejo-tenis-simon-bolivar',
    name: 'Complejo de Tenis Simón Bolívar',
    shortName: 'Simón Bolívar',
    kind: 'complex',
    sports: ['tennis'],
    city: 'Bogotá',
    neighborhood: 'Parque Simón Bolívar',
    address: 'Avenida Calle 63 # 68-95',
    howToArrive: 'Ingreso por la Av. 68. El complejo queda al costado norte del lago.',
    description: 'Canchas de polvo de ladrillo y dura, club house y graderías laterales. Sirve para copas universitarias y circuitos amateur.',
    surface: 'Arcilla / dura',
    capacity: 800,
    coverImageUrl: 'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=1600&q=80',
    imageUrls: [
      'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?auto=format&fit=crop&w=1200&q=80',
    ],
    lat: 4.658,
    lng: -74.0935,
    contact: {
      name: 'Club de tenis',
      role: 'Recepción',
      phone: '+57 601 437 2200',
      email: 'tenis@simonbolivar.demo',
      whatsapp: '573104445566',
    },
    featured: true,
  },
  {
    id: 'v-voley-salitre',
    slug: 'coliseo-voleibol-el-salitre',
    name: 'Coliseo de Voleibol El Salitre',
    shortName: 'El Salitre',
    kind: 'indoor',
    sports: ['volleyball'],
    city: 'Bogotá',
    neighborhood: 'Barrios Unidos',
    address: 'Carrera 68 # 63-44',
    howToArrive: 'Frente al Parque El Salitre. Parada de bus en Carrera 68 con 63.',
    description: 'Cancha central homologada para voleibol, redes de entrenamiento y zona de warm-up. Iluminación para transmisiones nocturnas.',
    surface: 'Piso sintético indoor',
    capacity: 1800,
    coverImageUrl: 'https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?auto=format&fit=crop&w=1600&q=80',
    imageUrls: [
      'https://images.unsplash.com/photo-1547347298-4074fc3086f0?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1461896836934-ffe607ba6851?auto=format&fit=crop&w=1200&q=80',
    ],
    lat: 4.6658,
    lng: -74.087,
    contact: {
      name: 'Liga de voleibol',
      role: 'Administración',
      phone: '+57 601 225 8800',
      email: 'voleibol@elsalitre.demo',
    },
  },
  {
    id: 'v-sintetica-93',
    slug: 'cancha-sintetica-la-93',
    name: 'Cancha sintética La 93',
    shortName: 'La 93',
    kind: 'court',
    sports: ['football'],
    city: 'Bogotá',
    neighborhood: 'Chicó',
    address: 'Calle 93 # 14-20',
    howToArrive: 'Sobre la 93, a dos cuadras de la Carrera 15. Portería sobre el costado sur.',
    description: 'Cancha 7v7 con césped sintético, mallas perimetrales, camerinos y kiosco. Ideal para torneos empresariales y ligas de barrio.',
    surface: 'Césped sintético',
    capacity: 120,
    coverImageUrl: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1600&q=80',
    imageUrls: [
      'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1517927033932-b3d18e61fb3a?auto=format&fit=crop&w=1200&q=80',
    ],
    lat: 4.6765,
    lng: -74.0488,
    contact: {
      name: 'Julián Castro',
      role: 'Administrador',
      phone: '+57 310 555 0193',
      email: 'reservas@la93.demo',
      whatsapp: '573105550193',
    },
  },
  {
    id: 'v-atanasio',
    slug: 'estadio-atanasio-girardot',
    name: 'Estadio Atanasio Girardot',
    shortName: 'Atanasio',
    kind: 'stadium',
    sports: ['football'],
    city: 'Medellín',
    neighborhood: 'Estadio',
    address: 'Carrera 74 # 48-21',
    howToArrive: 'Metro: estación Estadio. Acceso principal por la Carrera 74.',
    description: 'Unidad deportiva con estadio de fútbol, pista y zonas de calentamiento. Sede de clásicos paisas y copas regionales.',
    surface: 'Césped natural',
    capacity: 44739,
    coverImageUrl: 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=1600&q=80',
    imageUrls: [
      'https://images.unsplash.com/photo-1577223625816-7546f13df25d?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1489944440615-453fc2b6a9a9?auto=format&fit=crop&w=1200&q=80',
    ],
    lat: 6.2569,
    lng: -75.5901,
    contact: {
      name: 'Unidad Deportiva',
      role: 'Eventos',
      phone: '+57 604 444 4144',
      email: 'eventos@atanasio.demo',
    },
    featured: true,
  },
  {
    id: 'v-padel-envigado',
    slug: 'club-padel-envigado',
    name: 'Club de Pádel Envigado',
    shortName: 'Pádel Envigado',
    kind: 'complex',
    sports: ['padel'],
    city: 'Envigado',
    neighborhood: 'Zúñiga',
    address: 'Calle 37 Sur # 43-18',
    howToArrive: 'Sobre la avenida El Poblado, desviación a Zúñiga. Parqueadero interno.',
    description: 'Cuatro canchas panóramicas cubiertas, pro shop y terraza. Disponible para ligas interclubes y clínicas.',
    surface: 'Césped de pádel',
    capacity: 200,
    coverImageUrl: 'https://images.unsplash.com/photo-1622163642998-1ea32b0bbc67?auto=format&fit=crop&w=1600&q=80',
    imageUrls: [
      'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?auto=format&fit=crop&w=1200&q=80',
    ],
    lat: 6.1698,
    lng: -75.583,
    contact: {
      name: 'Recepción del club',
      phone: '+57 604 322 9090',
      email: 'hola@padelenvigado.demo',
      whatsapp: '573152229090',
    },
  },
];

export function getVenues(): Venue[] {
  return MOCK_VENUES;
}

/** Canchas publicadas que aceptan el deporte del torneo. */
export function getVenuesForSport(sport: string): Venue[] {
  return MOCK_VENUES
    .filter(v => v.sports.includes(sport as Sport))
    .sort((a, b) => a.city.localeCompare(b.city, 'es') || a.name.localeCompare(b.name, 'es'));
}

export function getFeaturedVenues(): Venue[] {
  return MOCK_VENUES.filter(v => v.featured);
}

export function getVenueBySlug(slug: string): Venue | null {
  return MOCK_VENUES.find(v => v.slug === slug) ?? null;
}

export function venueSports(venues: Venue[] = MOCK_VENUES): Sport[] {
  return [...new Set(venues.flatMap(v => v.sports))];
}

export function osmEmbedUrl(lat: number, lng: number, delta = 0.008): string {
  const bbox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${lat}%2C${lng}`;
}

export function osmOpenUrl(lat: number, lng: number): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`;
}

export function formatCapacity(n?: number): string | null {
  if (!n) return null;
  return `${n.toLocaleString('es-CO')} personas`;
}

export function whatsappUrl(phone: string): string {
  return `https://wa.me/${phone.replace(/\D/g, '')}`;
}
