// Map country name → flag emoji. Covers all countries commonly seen in VEX.
// Fallback: 🏳️ for unknown.
const FLAGS: Record<string, string> = {
  "Afghanistan": "🇦🇫", "Albania": "🇦🇱", "Algeria": "🇩🇿", "Andorra": "🇦🇩",
  "Angola": "🇦🇴", "Argentina": "🇦🇷", "Armenia": "🇦🇲", "Australia": "🇦🇺",
  "Austria": "🇦🇹", "Azerbaijan": "🇦🇿", "Bahamas": "🇧🇸", "Bahrain": "🇧🇭",
  "Bangladesh": "🇧🇩", "Barbados": "🇧🇧", "Belarus": "🇧🇾", "Belgium": "🇧🇪",
  "Belize": "🇧🇿", "Bermuda": "🇧🇲", "Bolivia": "🇧🇴", "Bosnia and Herzegovina": "🇧🇦",
  "Botswana": "🇧🇼", "Brazil": "🇧🇷", "Brunei": "🇧🇳", "Bulgaria": "🇧🇬",
  "Cambodia": "🇰🇭", "Cameroon": "🇨🇲", "Canada": "🇨🇦", "Chile": "🇨🇱",
  "China": "🇨🇳", "Colombia": "🇨🇴", "Costa Rica": "🇨🇷", "Croatia": "🇭🇷",
  "Cuba": "🇨🇺", "Cyprus": "🇨🇾", "Czech Republic": "🇨🇿", "Czechia": "🇨🇿",
  "Denmark": "🇩🇰", "Dominican Republic": "🇩🇴", "Ecuador": "🇪🇨", "Egypt": "🇪🇬",
  "El Salvador": "🇸🇻", "Estonia": "🇪🇪", "Ethiopia": "🇪🇹", "Fiji": "🇫🇯",
  "Finland": "🇫🇮", "France": "🇫🇷", "Georgia": "🇬🇪", "Germany": "🇩🇪",
  "Ghana": "🇬🇭", "Greece": "🇬🇷", "Guatemala": "🇬🇹", "Guyana": "🇬🇾",
  "Haiti": "🇭🇹", "Honduras": "🇭🇳", "Hong Kong": "🇭🇰", "Hungary": "🇭🇺",
  "Iceland": "🇮🇸", "India": "🇮🇳", "Indonesia": "🇮🇩", "Iran": "🇮🇷",
  "Iraq": "🇮🇶", "Ireland": "🇮🇪", "Israel": "🇮🇱", "Italy": "🇮🇹",
  "Jamaica": "🇯🇲", "Japan": "🇯🇵", "Jordan": "🇯🇴", "Kazakhstan": "🇰🇿",
  "Kenya": "🇰🇪", "Korea, Republic of": "🇰🇷", "South Korea": "🇰🇷",
  "Kuwait": "🇰🇼", "Kyrgyzstan": "🇰🇬", "Laos": "🇱🇦", "Latvia": "🇱🇻",
  "Lebanon": "🇱🇧", "Libya": "🇱🇾", "Lithuania": "🇱🇹", "Luxembourg": "🇱🇺",
  "Macao": "🇲🇴", "Macau": "🇲🇴", "Madagascar": "🇲🇬", "Malaysia": "🇲🇾",
  "Maldives": "🇲🇻", "Mali": "🇲🇱", "Malta": "🇲🇹", "Mauritius": "🇲🇺",
  "Mexico": "🇲🇽", "Moldova": "🇲🇩", "Mongolia": "🇲🇳", "Montenegro": "🇲🇪",
  "Morocco": "🇲🇦", "Mozambique": "🇲🇿", "Myanmar": "🇲🇲", "Namibia": "🇳🇦",
  "Nepal": "🇳🇵", "Netherlands": "🇳🇱", "New Zealand": "🇳🇿", "Nicaragua": "🇳🇮",
  "Nigeria": "🇳🇬", "North Macedonia": "🇲🇰", "Norway": "🇳🇴", "Oman": "🇴🇲",
  "Pakistan": "🇵🇰", "Palestine": "🇵🇸", "Panama": "🇵🇦", "Papua New Guinea": "🇵🇬",
  "Paraguay": "🇵🇾", "Peru": "🇵🇪", "Philippines": "🇵🇭", "Poland": "🇵🇱",
  "Portugal": "🇵🇹", "Puerto Rico": "🇵🇷", "Qatar": "🇶🇦", "Romania": "🇷🇴",
  "Russia": "🇷🇺", "Rwanda": "🇷🇼", "Saudi Arabia": "🇸🇦", "Senegal": "🇸🇳",
  "Serbia": "🇷🇸", "Singapore": "🇸🇬", "Slovakia": "🇸🇰", "Slovenia": "🇸🇮",
  "South Africa": "🇿🇦", "Spain": "🇪🇸", "Sri Lanka": "🇱🇰", "Sudan": "🇸🇩",
  "Sweden": "🇸🇪", "Switzerland": "🇨🇭", "Syria": "🇸🇾", "Taiwan": "🇹🇼",
  "Tajikistan": "🇹🇯", "Tanzania": "🇹🇿", "Thailand": "🇹🇭", "Trinidad and Tobago": "🇹🇹",
  "Tunisia": "🇹🇳", "Turkey": "🇹🇷", "Turkmenistan": "🇹🇲",
  "Uganda": "🇺🇬", "Ukraine": "🇺🇦", "United Arab Emirates": "🇦🇪",
  "United Kingdom": "🇬🇧", "United States": "🇺🇸", "USA": "🇺🇸",
  "Uruguay": "🇺🇾", "Uzbekistan": "🇺🇿", "Venezuela": "🇻🇪",
  "Vietnam": "🇻🇳", "Yemen": "🇾🇪", "Zambia": "🇿🇲", "Zimbabwe": "🇿🇼",
};

export function countryFlag(country: string | null | undefined): string {
  if (!country) return "";
  return FLAGS[country] ?? FLAGS[country.trim()] ?? "🏳️";
}

export function countryWithFlag(country: string): string {
  return `${countryFlag(country)} ${country}`;
}
