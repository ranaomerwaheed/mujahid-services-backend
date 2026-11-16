export interface AreaDirectoryGroup {
  city: 'Multan' | 'Khanewal' | 'Surrounding Towns';
  dispatchHub: string;
  eta: string;
  areas: string[];
}

export const FAMOUS_AREAS_DIRECTORY: AreaDirectoryGroup[] = [
  {
    city: 'Multan',
    dispatchHub: 'Bosan Road & Model Town Hub, Multan',
    eta: '45–75 min dispatch',
    areas: [
      'DHA Multan',
      'Model Town',
      'Gulgasht Colony',
      'Bosan Road',
      'Multan Cantt',
      'Shah Rukn-e-Alam Colony',
      'New Multan',
      'Wapda Town',
      'Buch Executive Villas',
      'Royal Orchard',
      'Mumtazabad',
      'Abdali Road',
      'Chungi No. 9',
      'Nishtar Road',
      'Sher Shah Road',
      'Hussain Agahi',
      'Vehari Road',
      'Bahawalpur Bypass',
    ],
  },
  {
    city: 'Khanewal',
    dispatchHub: 'Main Multan Road Central Workshop, Khanewal',
    eta: '30–60 min dispatch',
    areas: [
      'Peoples Colony',
      'Civil Lines',
      'Model Town Khanewal',
      'Tariq Abad',
      'Sir Syed Town',
      'Chak Shahana Road',
      'Old Khanewal',
      'Faisal Town',
      'Gulshan-e-Rehman',
      'Main Multan Road',
      'Bypass Road Khanewal',
      'Railway Colony',
      'Colony No. 1 & 2',
      'Jinnah Colony',
    ],
  },
  {
    city: 'Surrounding Towns',
    dispatchHub: 'Regional Cold-Chain & Commercial Fleet',
    eta: '60–120 min dispatch',
    areas: [
      'Kabirwala',
      'Jahania',
      'Mian Channu',
      'Vehari',
      'Shujabad',
      'Lodhran',
      'Makhdoom Pur Pahoran',
      'Abdul Hakim',
    ],
  },
];

export const ALL_SERVICE_AREAS: string[] = FAMOUS_AREAS_DIRECTORY.flatMap((g) => g.areas);
