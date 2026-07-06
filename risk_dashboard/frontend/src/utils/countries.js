// Canonical country list — shared between SupplierTable and CsvPreviewModal
export const COUNTRIES = [
  'Afghanistan','Albania','Algeria','Andorra','Angola','Argentina','Armenia',
  'Australia','Austria','Azerbaijan','Bahamas','Bahrain','Bangladesh','Belarus',
  'Belgium','Belize','Benin','Bhutan','Bolivia','Bosnia and Herzegovina',
  'Botswana','Brazil','Brunei','Bulgaria','Burkina Faso','Burundi','Cambodia',
  'Cameroon','Canada','Cape Verde','Central African Republic','Chad','Chile',
  'China','Colombia','Comoros','Costa Rica','Croatia','Cuba','Cyprus',
  'Czech Republic','Denmark','Djibouti','Dominican Republic','DR Congo','Ecuador',
  'Egypt','El Salvador','Eritrea','Estonia','Eswatini','Ethiopia','Fiji',
  'Finland','France','Gabon','Gambia','Georgia','Germany','Ghana','Greece',
  'Guatemala','Guinea','Haiti','Honduras','Hungary','Iceland','India',
  'Indonesia','Iran','Iraq','Ireland','Israel','Italy','Jamaica','Japan',
  'Jordan','Kazakhstan','Kenya','Kuwait','Kyrgyzstan','Laos','Latvia','Lebanon',
  'Liberia','Libya','Liechtenstein','Lithuania','Luxembourg','Madagascar',
  'Malawi','Malaysia','Maldives','Mali','Malta','Mauritania','Mauritius',
  'Mexico','Moldova','Monaco','Mongolia','Montenegro','Morocco','Mozambique',
  'Myanmar','Namibia','Nepal','Netherlands','New Zealand','Nicaragua','Niger',
  'Nigeria','North Korea','North Macedonia','Norway','Oman','Pakistan','Panama',
  'Papua New Guinea','Paraguay','Peru','Philippines','Poland','Portugal','Qatar',
  'Romania','Russia','Rwanda','Saudi Arabia','Senegal','Serbia','Sierra Leone',
  'Singapore','Slovakia','Slovenia','Somalia','South Africa','South Korea',
  'South Sudan','Spain','Sri Lanka','Sudan','Sweden','Switzerland','Syria',
  'Taiwan','Tajikistan','Tanzania','Thailand','Togo','Trinidad and Tobago',
  'Tunisia','Turkey','Turkmenistan','Uganda','UK','Ukraine',
  'United Arab Emirates','United Kingdom','United States','Uruguay','USA',
  'Uzbekistan','Venezuela','Vietnam','Yemen','Zambia','Zimbabwe',
];

// Normalise for case-insensitive and space-insensitive lookup
const normalize = (str) => (str || '').toLowerCase().replace(/\s+/g, '');
export const COUNTRY_SET = new Set(COUNTRIES.map(normalize));

export function isValidCountry(val) {
  return COUNTRY_SET.has(normalize(val));
}

export function getCanonicalCountry(val) {
  const norm = normalize(val);
  return COUNTRIES.find(c => normalize(c) === norm) || val;
}
