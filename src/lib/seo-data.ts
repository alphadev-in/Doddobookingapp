// Data for the location + service landing pages (/{country}/{city}/{service}).
// 25 services x 5 countries x 40 cities = 5,000 pages, generated at build time.

export interface Service { slug: string; name: string; plural: string; blurb: string; }

export const SERVICES: Service[] = [
  { slug: 'barber', name: 'Barber', plural: 'barbers', blurb: 'Fades, beard trims and hot towel shaves, with booking that fits around the barber chair.' },
  { slug: 'hair-salon', name: 'Hair salon', plural: 'hair salons', blurb: 'Cuts, colour and styling, with each stylist’s hours and colour bar on one shared calendar.' },
  { slug: 'hairdresser', name: 'Hairdresser', plural: 'hairdressers', blurb: 'Simple online booking for independent hairdressers and mobile stylists.' },
  { slug: 'beauty-salon', name: 'Beauty salon', plural: 'beauty salons', blurb: 'Facials, waxing and treatments, with deposits to protect your chair time.' },
  { slug: 'nail-salon', name: 'Nail salon', plural: 'nail salons', blurb: 'Manicures, pedicures and gel sets, booked in the slot length that suits each treatment.' },
  { slug: 'eyelash-extensions', name: 'Eyelash extensions', plural: 'eyelash technicians', blurb: 'Longer sessions with buffer time built in for cleaning and set-up between clients.' },
  { slug: 'makeup-artist', name: 'Makeup artist', plural: 'makeup artists', blurb: 'Bridal trials and events, with deposits held for dates you have reserved.' },
  { slug: 'massage-therapist', name: 'Massage therapist', plural: 'massage therapists', blurb: 'Treatment rooms, therapist hours and reminders that cut down on missed sessions.' },
  { slug: 'physiotherapist', name: 'Physiotherapist', plural: 'physiotherapists', blurb: 'Clinic appointments and follow-ups, with a clear cancellation window for each clinic.' },
  { slug: 'personal-trainer', name: 'Personal trainer', plural: 'personal trainers', blurb: 'Book sessions around your training schedule, with reminders sent before each one.' },
  { slug: 'yoga-instructor', name: 'Yoga instructor', plural: 'yoga instructors', blurb: 'Private and small-group sessions, with one place for your studio and teachers.' },
  { slug: 'pilates-studio', name: 'Pilates studio', plural: 'pilates studios', blurb: 'Reformer and mat sessions with the right slot length for every class type.' },
  { slug: 'dentist', name: 'Dentist', plural: 'dental practices', blurb: 'Online booking for check-ups and treatments, with reminders to reduce missed visits.' },
  { slug: 'dental-hygienist', name: 'Dental hygienist', plural: 'dental hygienists', blurb: 'Hygienist hours and appointment lengths managed in one calendar.' },
  { slug: 'tattoo-artist', name: 'Tattoo artist', plural: 'tattoo artists', blurb: 'Consultations and sittings, with deposits held for custom designs.' },
  { slug: 'piercing-studio', name: 'Piercing studio', plural: 'piercing studios', blurb: 'Walk-ins and bookings on one calendar, with buffer time for sterilising.' },
  { slug: 'spa', name: 'Spa', plural: 'spas', blurb: 'Packages and treatment rooms, booked across therapists with deposits for longer sessions.' },
  { slug: 'aesthetics-clinic', name: 'Aesthetics clinic', plural: 'aesthetics clinics', blurb: 'Consultations and treatments with clear policies and secure deposits.' },
  { slug: 'driving-instructor', name: 'Driving instructor', plural: 'driving instructors', blurb: 'Lesson slots that fit your diary, with reminders that cut down cancellations.' },
  { slug: 'tutor', name: 'Tutor', plural: 'tutors', blurb: 'Session bookings for one-to-one and group tuition, with notes kept private.' },
  { slug: 'photographer', name: 'Photographer', plural: 'photographers', blurb: 'Shoot dates and consultations, with deposits to secure your session.' },
  { slug: 'dog-groomer', name: 'Dog groomer', plural: 'dog groomers', blurb: 'Grooming slots sized by breed and service, with reminders for every appointment.' },
  { slug: 'mobile-hairdresser', name: 'Mobile hairdresser', plural: 'mobile hairdressers', blurb: 'Book home visits with travel time built into each slot.' },
  { slug: 'osteopath', name: 'Osteopath', plural: 'osteopaths', blurb: 'Clinic bookings and follow-up sessions, managed across rooms and practitioners.' },
  { slug: 'chiropractor', name: 'Chiropractor', plural: 'chiropractors', blurb: 'Adjustment and assessment slots, with reminders and a clear cancellation policy.' },
  { slug: 'hair-removal', name: 'Hair removal clinic', plural: 'hair removal clinics', blurb: 'Laser and waxing sessions, with patch-test time and secure deposits.' },
];

export interface Country { code: string; name: string; cities: string[]; }

export const COUNTRIES: Country[] = [
  { code: 'uk', name: 'United Kingdom', cities: ['London','Manchester','Birmingham','Leeds','Glasgow','Liverpool','Bristol','Sheffield','Edinburgh','Leicester','Coventry','Bradford','Cardiff','Belfast','Nottingham','Newcastle upon Tyne','Southampton','Portsmouth','Brighton','Plymouth','Reading','Oxford','Cambridge','Norwich','Derby','Swansea','Aberdeen','Dundee','Inverness','York','Bath','Exeter','Canterbury','Chester','Milton Keynes','Luton','Ipswich','Wolverhampton','Stoke-on-Trent','Hull','Sunderland'] },
  { code: 'us', name: 'United States', cities: ['New York','Los Angeles','Chicago','Houston','Phoenix','Philadelphia','San Antonio','San Diego','Dallas','San Jose','Austin','Jacksonville','Fort Worth','Columbus','Charlotte','San Francisco','Indianapolis','Seattle','Denver','Washington','Boston','Nashville','Detroit','Oklahoma City','Portland','Las Vegas','Memphis','Louisville','Baltimore','Milwaukee','Albuquerque','Tucson','Fresno','Sacramento','Kansas City','Atlanta','Miami','Raleigh','Omaha','Minneapolis','Tampa'] },
  { code: 'ca', name: 'Canada', cities: ['Toronto','Montreal','Vancouver','Calgary','Edmonton','Ottawa','Winnipeg','Quebec City','Hamilton','Kitchener','London','Victoria','Halifax','Oshawa','Windsor','Saskatoon','Regina',"St. John's",'Kelowna','Barrie','Abbotsford','Surrey','Burnaby','Richmond','Markham','Vaughan','Mississauga','Brampton','Laval','Gatineau','Sherbrooke','Kingston','Moncton','Fredericton','Charlottetown','Whitehorse','Yellowknife','Nanaimo','Guelph','Thunder Bay','Sudbury'] },
  { code: 'au', name: 'Australia', cities: ['Sydney','Melbourne','Brisbane','Perth','Adelaide','Gold Coast','Newcastle','Canberra','Sunshine Coast','Wollongong','Geelong','Hobart','Townsville','Cairns','Darwin','Toowoomba','Ballarat','Bendigo','Albury','Launceston','Mackay','Rockhampton','Bunbury','Bundaberg','Coffs Harbour','Wagga Wagga','Hervey Bay','Mildura','Shepparton','Port Macquarie','Tamworth','Orange','Dubbo','Geraldton','Kalgoorlie','Warrnambool','Lismore','Nowra','Bathurst','Armidale','Gympie'] },
  { code: 'ie', name: 'Ireland', cities: ['Dublin','Cork','Limerick','Galway','Waterford','Drogheda','Dundalk','Swords','Bray','Navan','Kilkenny','Ennis','Carlow','Tralee','Newbridge','Portlaoise','Naas','Balbriggan','Athlone','Mullingar','Celbridge','Wexford','Letterkenny','Sligo','Clonmel','Greystones','Killarney','Shannon','Tullamore','Cavan','Castlebar','Dungarvan','Ballina','Mallow','Nenagh','Thurles','Athy','Bandon','Monaghan','Skibbereen','Killaloe'] },
];

export const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export const countryBySlug = (code: string) => COUNTRIES.find((c) => c.code === code);

/** Other services in the same city, and other cities for the same service, for internal linking. */
export function related(countryCode: string, citySlug: string, serviceSlug: string) {
  const c = countryBySlug(countryCode);
  if (!c) return { services: [], cities: [] };
  const services = SERVICES.filter((s) => s.slug !== serviceSlug).slice(0, 6);
  const cities = c.cities.filter((x) => slugify(x) !== citySlug).slice(0, 6);
  return { services, cities };
}
