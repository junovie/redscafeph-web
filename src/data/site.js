export const PERKS_URL = "https://perks.redscafeph.com/";
export const STORE_URL = "https://store.redscafeph.com";
export const IS_STORE_HOST = typeof window !== "undefined" && window.location.hostname.startsWith("store.");
// The online store runs on store.redscafeph.com; its nav sends the other pages back to www.
const site = (path) => (IS_STORE_HOST ? `https://www.redscafeph.com${path}` : path);

export const HOURS = "Everything's open from 7AM til 2AM daily.";

const maps = (q) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;

export const LOCATIONS = [
  {
    name: "Red's Cafe",
    where: "Raintree Mall Ramos, near Velez College",
    map: maps("Red's Cafe Raintree Mall Ramos Cebu"),
  },
  {
    name: "Red's Cafe Too",
    where: "Quest Homes, North Reclamation Mandaue, right beside Cebu Doctors' University",
    map: maps("Red's Cafe Too Quest Homes North Reclamation Mandaue"),
  },
  {
    name: "Also Red's Cafe",
    where: "Qhub, Good Shepherd Road, Banawa. Can't miss it going to Apple One.",
    map: maps("Also Red's Cafe Qhub Good Shepherd Road Banawa Cebu"),
  },
];

export const EMAILS = [
  "collab@redscafeph.com",
  "inquire@redscafeph.com",
  "sponsorships@redscafeph.com",
  "jobs@redscafeph.com",
];

export const SOCIALS = [
  { name: "Facebook", label: "Facebook.com/redscafeph", href: "https://www.facebook.com/redscafeph" },
  { name: "Instagram", label: "Instagram.com/redscafeph", href: "https://www.instagram.com/redscafeph" },
  { name: "TikTok", label: "Tiktok.com/@redscafeph", href: "https://www.tiktok.com/@redscafeph" },
];

export const NAV = [
  { to: site("/"), label: "Home" },
  { to: site("/menu"), label: "Menu" },
  { to: IS_STORE_HOST ? "/" : STORE_URL, label: "Order online" },
  { to: site("/rewards"), label: "Rewards" },
  { to: site("/this-is-us"), label: "This is us" },
  { to: site("/reviews"), label: "Reviews" },
];
