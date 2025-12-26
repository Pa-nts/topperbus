export type BuildingCategory = 'academic' | 'residential' | 'dining' | 'administrative' | 'athletics' | 'library' | 'recreation' | 'parking' | 'health';

export interface CampusBuilding {
  id: string;
  name: string;
  abbreviation: string;
  lat: number;
  lon: number;
  categories: BuildingCategory[]; // Primary category first, then secondary
  department: string;
  description: string;
  imageUrl?: string;
}

// Category icons as SVG paths (16x16 viewBox)
export const CATEGORY_ICONS: Record<BuildingCategory, { path: string; label: string }> = {
  academic: {
    path: 'M8 0L0 4v1h16V4L8 0zM1 6v7h2V6H1zm4 0v7h2V6H5zm4 0v7h2V6H9zm4 0v7h2V6h-2zM0 14v2h16v-2H0z',
    label: 'Academic',
  },
  residential: {
    path: 'M8 0L0 6v10h6v-5h4v5h6V6L8 0zm0 9a2 2 0 110-4 2 2 0 010 4z',
    label: 'Residential',
  },
  dining: {
    path: 'M2 0v7c0 1.1.9 2 2 2h1v7h2V9h1c1.1 0 2-.9 2-2V0H8v5H6V0H4v5H2V0zm10 0v6h2v4h-2v6h2V10h2V4c0-2.2-1.8-4-4-4z',
    label: 'Dining',
  },
  administrative: {
    path: 'M8 0L0 3v2h16V3L8 0zM2 6v8H0v2h16v-2h-2V6h-3v8H9V6H7v8H5V6H2z',
    label: 'Administrative',
  },
  athletics: {
    path: 'M12 4a4 4 0 00-8 0c0 1.5.8 2.8 2 3.5V16h4V7.5c1.2-.7 2-2 2-3.5zm-4-2a2 2 0 110 4 2 2 0 010-4z',
    label: 'Athletics',
  },
  library: {
    path: 'M8 0L1 3v13h2V5l5-2 5 2v11h2V3L8 0zM4 6v9h2V7l2-.8 2 .8v8h2V6L8 4 4 6z',
    label: 'Library',
  },
  recreation: {
    path: 'M8 0a3 3 0 100 6 3 3 0 000-6zM4 7c-1.1 0-2 .9-2 2v5h2v2h8v-2h2V9c0-1.1-.9-2-2-2H4z',
    label: 'Recreation',
  },
  parking: {
    path: 'M2 0C.9 0 0 .9 0 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V2c0-1.1-.9-2-2-2H2zm4 3h4c1.7 0 3 1.3 3 3s-1.3 3-3 3H8v4H6V3zm2 4h2c.6 0 1-.4 1-1s-.4-1-1-1H8v2z',
    label: 'Parking',
  },
  health: {
    path: 'M14 5h-3V2c0-1.1-.9-2-2-2H7c-1.1 0-2 .9-2 2v3H2c-1.1 0-2 .9-2 2v2c0 1.1.9 2 2 2h3v3c0 1.1.9 2 2 2h2c1.1 0 2-.9 2-2v-3h3c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2z',
    label: 'Health',
  },
};

// WKU Campus Buildings with accurate coordinates from Google Maps
export const CAMPUS_BUILDINGS: CampusBuilding[] = [
  // === ACADEMIC BUILDINGS ===
  {
    id: 'cherry',
    name: 'Cherry Hall',
    abbreviation: 'CH',
    lat: 36.98751,
    lon: -86.45114,
    categories: ['administrative', 'academic'],
    department: 'Administration & Liberal Arts',
    description: 'WKU\'s most iconic building, named after founder Henry Hardin Cherry. Built in 1937, this Collegiate Gothic structure sits atop "The Hill" and serves as the administrative heart of the university. Its distinctive tower is visible across Bowling Green.',
  },
  {
    id: 'grise',
    name: 'Grise Hall',
    abbreviation: 'GH',
    lat: 36.98565,
    lon: -86.45439,
    categories: ['academic'],
    department: 'Potter College of Arts & Letters',
    description: 'Home to the English, History, Philosophy & Religion, and Political Science departments. Named after Finley C. Grise, dean of the college from 1927-1959.',
  },
  {
    id: 'fac',
    name: 'Fine Arts Center',
    abbreviation: 'FAC',
    lat: 36.98646,
    lon: -86.45323,
    categories: ['academic'],
    department: 'Potter College of Arts & Letters',
    description: 'The Ivan Wilson Fine Arts Center houses the Art, Music, and Theatre & Dance departments. Features galleries, performance spaces, and studios.',
  },
  {
    id: 'snell',
    name: 'Snell Hall',
    abbreviation: 'SNL',
    lat: 36.98640,
    lon: -86.44866,
    categories: ['academic'],
    department: 'Ogden College of Science & Engineering',
    description: 'Key facility for science education at WKU, housing laboratories and classrooms for biology, chemistry, and other sciences.',
  },
  {
    id: 'thompson',
    name: 'Kelly Thompson Hall',
    abbreviation: 'TC',
    lat: 36.98527,
    lon: -86.45294,
    categories: ['academic'],
    department: 'Ogden College of Science & Engineering',
    description: 'Houses chemistry and physics programs. Named for Dr. Kelly Thompson, WKU\'s third president. Features laboratories and research facilities.',
  },
  {
    id: 'est',
    name: 'Environmental Sciences & Technology',
    abbreviation: 'EST',
    lat: 36.98607,
    lon: -86.44997,
    categories: ['academic'],
    department: 'Ogden College of Science & Engineering',
    description: 'State-of-the-art facility supporting environmental research. Houses programs in geography, geology, and environmental science.',
  },
  {
    id: 'grh',
    name: 'Gary A. Ransdell Hall',
    abbreviation: 'GRH',
    lat: 36.98205,
    lon: -86.45613,
    categories: ['academic'],
    department: 'Gordon Ford College of Business',
    description: 'Houses the Gordon Ford College of Business. Named after WKU\'s ninth president. Features a trading room and collaborative spaces.',
  },
  {
    id: 'jrh',
    name: 'Jody Richards Hall',
    abbreviation: 'JRH',
    lat: 36.98291,
    lon: -86.45649,
    categories: ['academic'],
    department: 'Communication Sciences & Disorders',
    description: 'Houses Communication Sciences & Disorders and other programs. Named after former Kentucky House Speaker Jody Richards.',
  },

  // === LIBRARY ===
  {
    id: 'Library',
    name: 'Raymond Cravens Library',
    abbreviation: 'LIB',
    lat: 36.98560,
    lon: -86.45259,
    categories: ['library'],
    department: 'University Libraries',
    description: 'WKU\'s main library offering extensive collections, study spaces, and research support. Cravens Library (1969).',
  },
  {
    id: 'Commons',
    name: 'The Commons at Helm Library',
    abbreviation: 'COM',
    lat: 36.98560,
    lon: -86.45259,
    categories: ['library', 'dining'],
    department: 'University Libraries',
    description: 'WKU\'s secondary library offering additional extensive collections, study spaces, and research support.',
  },

  // === ADMINISTRATIVE ===
  {
    id: 'wab',
    name: 'Wetherby Administration Building',
    abbreviation: 'WAB',
    lat: 36.98737,
    lon: -86.45378,
    categories: ['administrative'],
    department: 'University Administration',
    description: 'Houses key university offices including the President\'s Office, Provost, and other administrative functions. Named after Governor Lawrence Wetherby.',
  },
  {
    id: 'alumni',
    name: 'Eva and Jim Martens Alumni Center',
    abbreviation: 'AAC',
    lat: 36.98385,
    lon: -86.45120,
    categories: ['administrative'],
    department: 'WKU Alumni Association',
    description: 'Home of the WKU Alumni Association. Hosts events, meetings, and programs connecting alumni with current students.',
  },

  // === DINING & STUDENT LIFE ===
  {
    id: 'dsu',
    name: 'Downing Student Union',
    abbreviation: 'DSU',
    lat: 36.98358,
    lon: -86.45624,
    categories: ['dining', 'administrative'],
    department: 'Student Affairs',
    description: 'The heart of campus life at WKU. Houses dining options, meeting spaces, the WKU Store, and student organization offices. Renovated and reopened in 2014.',
  },

  // === ATHLETICS ===
  {
    id: 'diddle',
    name: 'E.A. Diddle Arena',
    abbreviation: 'DA',
    lat: 36.98646,
    lon: -86.45763,
    categories: ['athletics'],
    department: 'WKU Athletics',
    description: 'Home of WKU Basketball, named after legendary coach Ed Diddle. Seats over 7,300 and is famous for the red towels waved by fans.',
  },
  {
    id: 'stadium',
    name: 'Houchens-L.T. Smith Stadium',
    abbreviation: 'STAD',
    lat: 36.98480,
    lon: -86.45943,
    categories: ['athletics'],
    department: 'WKU Athletics',
    description: 'Home to WKU Hilltopper Football. Originally built in 1968, the stadium seats over 22,000 fans with modern amenities.',
  },

  // === RECREATION ===
  {
    id: 'pc',
    name: 'Preston Center',
    abbreviation: 'PC',
    lat: 36.98306,
    lon: -86.45893,
    categories: ['recreation'],
    department: 'Campus Recreation',
    description: 'WKU\'s main recreation facility offering fitness equipment, basketball courts, a pool, rock climbing wall, and wellness programs.',
  },

  // === HEALTH ===
  {
    id: 'hs',
    name: 'Health Services',
    abbreviation: 'HS',
    lat: 36.98238,
    lon: -86.45771,
    categories: ['health'],
    department: 'Student Health Services',
    description: 'Provides medical care, counseling, and wellness resources to students. Offers primary care, mental health services, and health education.',
  },

  // === RESIDENTIAL ===
  {
    id: 'pft',
    name: 'Pearce-Ford Tower',
    abbreviation: 'PFT',
    lat: 36.98121,
    lon: -86.45005,
    categories: ['residential'],
    department: 'Housing & Residence Life',
    description: 'One of the tallest residence halls in the country at 27 stories. Houses over 1,000 students and offers stunning views of campus and Bowling Green.',
  },
  {
    id: 'bates',
    name: 'Bates-Runner Hall',
    abbreviation: 'BRH',
    lat: 36.98571,
    lon: -86.45592,
    categories: ['residential'],
    department: 'Housing & Residence Life',
    description: 'Traditional residence hall offering suite-style living. Named after two distinguished WKU staff members.',
  },
  {
    id: 'mclean',
    name: 'McLean Hall',
    abbreviation: 'MCL',
    lat: 36.98620,
    lon: -86.45497,
    categories: ['residential'],
    department: 'Housing & Residence Life',
    description: 'Historic residence hall named after M.B. McLean. Offers a close-knit community atmosphere.',
  },
  {
    id: 'munday',
    name: 'Munday Hall',
    abbreviation: 'MH',
    lat: 36.98466,
    lon: -86.45459,
    categories: ['residential'],
    department: 'Housing & Residence Life',
    description: 'Modern residence hall featuring suite-style rooms with shared living spaces. Located near academic buildings.',
  },
  {
    id: 'southwest',
    name: 'Southwest Hall',
    abbreviation: 'SWH',
    lat: 36.98437,
    lon: -86.45503,
    categories: ['residential'],
    department: 'Housing & Residence Life',
    description: 'Modern residence hall offering suite-style living. Located near athletic facilities and dining options.',
  },
  {
    id: 'minton',
    name: 'Minton Hall',
    abbreviation: 'MTN',
    lat: 36.98429,
    lon: -86.45605,
    categories: ['residential'],
    department: 'Housing & Residence Life',
    description: 'Honors residence hall providing academic-focused living community. Features study lounges and community spaces.',
  },
    {
    id: 'gilbert',
    name: 'Gilbert Hall',
    abbreviation: 'GIL',
    lat: 36.98764,
    lon: -86.45561,
    categories: ['residential'],
    department: 'Housing & Residence Life',
    description: 'Honors residence hall providing academic-focused living community. Features study lounges and community spaces.',
  },
  {
    id: 'mccormack',
    name: 'McCormack Hall',
    abbreviation: 'MCH',
    lat: 36.98824,
    lon: -86.45588,
    categories: ['residential'],
    department: 'Housing & Residence Life',
    description: 'Honors residence hall providing academic-focused living community. Features study lounges and community spaces.',
  },
  {
    id: 'rodes',
    name: 'Rodes Harlin Hall',
    abbreviation: 'RHH',
    lat: 36.98857,
    lon: -86.45517,
    categories: ['residential'],
    department: 'Housing & Residence Life',
    description: 'Honors residence hall providing academic-focused living community. Features study lounges and community spaces.',
  },
  {
    id: 'hugh',
    name: 'Hugh Poland Hall',
    abbreviation: 'HP',
    lat: 36.98197,
    lon: -86.45969,
    categories: ['residential'],
    department: 'Housing & Residence Life',
    description: 'Honors residence hall providing academic-focused living community. Features study lounges and community spaces.',
  },
  {
    id: 'douglas',
    name: 'Douglas Keen Hall',
    abbreviation: 'DK',
    lat: 36.98203,
    lon: -86.46049,
    categories: ['residential'],
    department: 'Housing & Residence Life',
    description: 'Honors residence hall providing academic-focused living community. Features study lounges and community spaces.',
  },
  {
    id: 'meredith',
    name: 'Meredith Hall',
    abbreviation: 'MER',
    lat: 36.98046,
    lon: -86.45983,
    categories: ['residential'],
    department: 'Housing & Residence Life',
    description: 'Honors residence hall providing academic-focused living community. Features study lounges and community spaces.',
  },
  {
    id: 'zacharias',
    name: 'Zacharias Hall',
    abbreviation: 'ZAC',
    lat: 36.97971,
    lon: -86.45990,
    categories: ['residential'],
    department: 'Housing & Residence Life',
    description: 'Honors residence hall providing academic-focused living community. Features study lounges and community spaces.',
  },
  {
    id: 'normal',
    name: 'Normal Hall',
    abbreviation: 'NH',
    lat: 36.98060,
    lon: -86.45882,
    categories: ['residential'],
    department: 'Housing & Residence Life',
    description: 'Honors residence hall providing academic-focused living community. Features study lounges and community spaces.',
  },
  {
    id: 'regents',
    name: 'Regents Hall',
    abbreviation: 'RH',
    lat: 36.98155,
    lon: -86.45820,
    categories: ['residential'],
    department: 'Housing & Residence Life',
    description: 'Honors residence hall providing academic-focused living community. Features study lounges and community spaces.',
  },

  // === PARKING ===  STILL NEED TO FINISH UPDATING!!!!!!!!!!!!!!!
  {
    id: 'ps1',
    name: 'Parking Structure 1',
    abbreviation: 'PS1',
    lat: 36.98270,
    lon: -86.45505,
    categories: ['parking'],
    department: 'Parking & Transportation',
    description: 'Multi-level parking structure near the center of campus. Provides convenient access to academic buildings and the DSU.',
  },
  {
    id: 'ps2',
    name: 'Parking Structure 2',
    abbreviation: 'PS2',
    lat: 36.98530,
    lon: -86.45115,
    categories: ['parking'],
    department: 'Parking & Transportation',
    description: 'Parking structure located on the east side of campus near the Science Campus buildings.',
  },
];

export const getBuildingById = (id: string): CampusBuilding | undefined => {
  return CAMPUS_BUILDINGS.find(b => b.id === id);
};

export const getBuildingsByCategory = (category: BuildingCategory): CampusBuilding[] => {
  return CAMPUS_BUILDINGS.filter(b => b.categories.includes(category));
};
