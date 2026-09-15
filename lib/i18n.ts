export type Locale = "en" | "hi";

const dict = {
  en: {
    home: "Home",
    bills: "Bills",
    wallet: "Wallet",
    scan: "Scan",
    profile: "Profile",
    balance: "Balance",
    addFunds: "Add Funds",
    payBills: "Pay Bills",
    recentBillers: "Recent billers",
    lockTitle: "Enter PIN",
    unlock: "Unlock",
    setPin: "Set app PIN",
    language: "Language",
    invite: "Invite sub-retailer",
    downloadReceipt: "Download receipt",
    shareReceipt: "Share",
  },
  hi: {
    home: "होम",
    bills: "बिल",
    wallet: "वॉलेट",
    scan: "स्कैन",
    profile: "प्रोफ़ाइल",
    balance: "बैलेंस",
    addFunds: "पैसे जोड़ें",
    payBills: "बिल भुगतान",
    recentBillers: "हाल के बिलर",
    lockTitle: "पिन दर्ज करें",
    unlock: "अनलॉक",
    setPin: "ऐप पिन सेट करें",
    language: "भाषा",
    invite: "सब-रिटेलर आमंत्रित करें",
    downloadReceipt: "रसीद डाउनलोड",
    shareReceipt: "शेयर",
  },
} as const;

export type DictKey = keyof typeof dict.en;

export function t(locale: Locale, key: DictKey): string {
  return dict[locale][key] || dict.en[key];
}
