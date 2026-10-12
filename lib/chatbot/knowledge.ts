// Single source of truth about CostCalc. Used (1) in the AI system prompt and
// (2) as an offline FAQ when the AI/server is unreachable.
// If you change pricing rules in lib/index.ts, update this text too.

export const PROJECT_KNOWLEDGE = `ABOUT COSTCALC
CostCalc is a web app that gives a fast, localized cost estimate and an editable quotation for projects.
Flow: (1) user describes the project (12-500 chars); (2) picks country and city and a category; (3) answers two questions: size (small=Focused, medium=Standard, large=Complex) and quality (essential, standard, premium); (4) gets the estimate page; (5) can open an editable quotation and save it as PDF (print).
CATEGORIES: 8 digital ones - web, mobile, ecommerce, design (UI/UX), seo, social (social media management), branding, ai. Projects that fit none of these - including OFFLINE/local businesses such as a tyre shop, mart, grocery, restaurant, salon, clinic, gym or warehouse - get a custom category researched for that business, with its own cost breakdown.
COUNTRIES (20 built in): us, ca, uk, ae, pk, in, au, de, sg, ng, sa, tr, ph, ke, my, bd, fr, br, eg, id. Every built-in country offers 5+ cities, and the estimate is priced for the chosen country AND city. For any other country the assistant looks up local price level, tax and exchange rate on the web; if the web is unavailable it falls back to a built-in table covering ~100 more countries, then to conservative defaults. So an estimate is always possible.
PRICE CALCULATION (done by code, never by AI): base price of category x country price level x city factor x size factor x quality factor, converted to local currency. The cost breakdown lines are NOT fixed - they follow what is being estimated (e.g. a shop build-out lists its own fit-out, equipment and licence items; a website lists design and development items). Then +5% contingency and the country's tax on (subtotal + contingency). Range: low = total -12%, high = total +17%. Timeline (weeks) scales with size and quality, +/-20%. Confidence 80-94% rises with how detailed the description is.
LIMITS: The result is a preliminary market estimate, not a legally binding quotation. Exchange rates are snapshots, not live. Quotation is valid 30 days; a 50% deposit may apply. History is stored only in the user's own browser (last 50 estimates).
PRIVACY: Text typed in the app or chat is sent to an AI provider to produce answers. CostCalc does not store it on a server.`;

export type FaqItem = { keys: string[]; en: string; roman: string; urdu: string };

// en = English, roman = Roman Urdu, urdu = Urdu script.
// keys are matched against the normalized (lowercased, punctuation-stripped) question.
export const FAQ: FaqItem[] = [
  {
    keys: ["what is costcalc", "costcalc kya", "project kya", "kya hai ye", "ye kya hai", "costcalc", "کوسٹ کیلک", "یہ کیا ہے", "کوسٹ کیلک کیا ہے"],
    en: "CostCalc turns a plain description of your project into a localized cost estimate, a timeline and an editable quotation you can save as PDF.",
    roman: "CostCalc aapke project ke description se local cost estimate, timeline aur editable quotation (PDF) bana deta hai.",
    urdu: "CostCalc آپ کے پروجیکٹ کی تفصیل سے مقامی لاگت کا اندازہ، ٹائم لائن اور ایڈیٹ کرنے کے قابل کوٹیشن (PDF) بنا دیتا ہے۔",
  },
  {
    keys: ["how does it work", "kaise work", "kaisy work", "kaise kaam", "kaisy kaam", "steps", "how to use", "کیسے کام", "کیسے استعمال", "کیسے چلتا"],
    en: "1) Describe your project. 2) Pick country and category. 3) Choose size and quality. 4) Get the estimate with breakdown, range and timeline. 5) Open the quotation and save it as PDF.",
    roman: "1) Project describe karein. 2) Country aur category chunein. 3) Size aur quality chunein. 4) Breakdown, range aur timeline wala estimate milta hai. 5) Quotation khol kar PDF save karein.",
    urdu: "1) اپنے پروجیکٹ کی تفصیل لکھیں۔ 2) ملک اور کیٹیگری منتخب کریں۔ 3) سائز اور کوالٹی چنیں۔ 4) بریک ڈاؤن، رینج اور ٹائم لائن کے ساتھ اندازہ ملتا ہے۔ 5) کوٹیشن کھول کر PDF محفوظ کریں۔",
  },
  {
    keys: ["how is price calculated", "price kaise", "price kaisy", "formula", "calculate", "accurate", "breakdown", "line items", "how much", "kitna", "kitne ka", "rate", "قیمت کیسے", "کتنا", "کتنے کا", "ریٹ", "قیمت"],
    en: "Price = category base x country price level x city factor x size x quality, plus 5% contingency and local tax. The breakdown lines change with the project: each category (and custom businesses) has its own cost items. Range is -12% / +17%. The math is by fixed code, not AI, so the same input always gives the same price.",
    roman: "Price = category base x country price level x city factor x size x quality, phir 5% contingency aur local tax lagta hai. Breakdown items project ke sath badalte hain: har category (aur custom businesses) ki apni cost items hoti hain. Range -12% / +17% hai. Hisab code karta hai, AI nahi, isliye same input par same price aata hai.",
    urdu: "قیمت = کیٹیگری بیس × ملک کا پرائس لیول × شہر کا فیکٹر × سائز × کوالٹی، پھر 5% کنٹینجینسی اور مقامی ٹیکس۔ بریک ڈاؤن آئٹمز پروجیکٹ کے مطابق بدلتے ہیں: ہر کیٹیگری (اور کسٹم بزنس) کے اپنے کاسٹ آئٹمز ہوتے ہیں۔ رینج −12% / +17% ہے۔ حساب کوڈ کرتا ہے، AI نہیں، اس لیے ایک ہی ان پٹ پر ہمیشہ ایک ہی قیمت آتی ہے۔",
  },
  {
    keys: ["categories", "category", "services", "kya kya banate", "کیٹیگری", "کیٹیگریز", "خدمات"],
    en: "8 digital categories: website, mobile app, ecommerce, UI/UX design, SEO, social media management, branding/graphic design and AI solutions. Offline businesses (tyre shop, mart, restaurant, salon, gym...) get their own researched custom category.",
    roman: "8 digital categories: website, mobile app, ecommerce, UI/UX design, SEO, social media, branding/graphic design aur AI solutions. Offline businesses (tyre shop, mart, restaurant, salon, gym waghera) ke liye apni custom category banti hai.",
    urdu: "8 ڈیجیٹل کیٹیگریز: ویب سائٹ، موبائل ایپ، ای کامرس، UI/UX ڈیزائن، SEO، سوشل میڈیا، برانڈنگ/گرافک ڈیزائن اور AI سلوشنز۔ آف لائن بزنس (ٹائر شاپ، مارٹ، ریسٹورنٹ، سیلون، جم وغیرہ) کے لیے اپنی کسٹم کیٹیگری بنتی ہے۔",
  },
  {
    keys: ["countries", "country", "kon si country", "which country", "cities", "city", "location", "shehar", "mulak", "ملک", "شہر", "کنٹری", "ممالک"],
    en: "20 countries are built in: US, Canada, UK, UAE, Pakistan, India, Australia, Germany, Singapore, Nigeria, Saudi Arabia, Turkey, Philippines, Kenya, Malaysia, Bangladesh, France, Brazil, Egypt and Indonesia. Each has 5+ cities. Any other country is researched on the web, with a built-in offline table of ~100 countries as backup.",
    roman: "20 countries built-in hain: US, Canada, UK, UAE, Pakistan, India, Australia, Germany, Singapore, Nigeria, Saudi Arabia, Turkey, Philippines, Kenya, Malaysia, Bangladesh, France, Brazil, Egypt aur Indonesia. Har country ki 5+ cities hain. Baqi countries web se research hoti hain, aur internet na ho to ~100 countries ki offline list se.",
    urdu: "20 ممالک بلٹ اِن ہیں: امریکہ، کینیڈا، برطانیہ، UAE، پاکستان، انڈیا، آسٹریلیا، جرمنی، سنگاپور، نائجیریا، سعودی عرب، ترکی، فلپائن، کینیا، ملائیشیا، بنگلہ دیش، فرانس، برازیل، مصر اور انڈونیشیا۔ ہر ملک کے 5+ شہر ہیں۔ باقی ممالک ویب سے ریسرچ ہوتے ہیں، اور انٹرنیٹ نہ ہو تو ~100 ممالک کی آف لائن فہرست سے۔",
  },
  {
    keys: ["tax", "contingency", "range", "confidence", "kitna tax", "ٹیکس", "کنٹینجینسی"],
    en: "Contingency is a fixed 5%. Tax is the country's rate applied to subtotal + contingency. Range is -12% to +17%. Confidence (80-94%) grows with how detailed your description is.",
    roman: "Contingency fixed 5% hai. Tax country ke rate se (subtotal + contingency) par lagta hai. Range -12% se +17% hai. Confidence (80-94%) description jitna detailed ho utna barhta hai.",
    urdu: "کنٹینجینسی مقررہ 5% ہے۔ ٹیکس ملک کے ریٹ سے (سب ٹوٹل + کنٹینجینسی) پر لگتا ہے۔ رینج −12% سے +17% ہے۔ کانفیڈنس (80-94%) تفصیل جتنی تفصیلی ہو، اتنی بڑھتی ہے۔",
  },
  {
    keys: ["privacy", "private", "data safe", "save", "history", "saved", "رازداری", "ڈیٹا", "ہسٹری"],
    en: "Your history is saved only in your own browser. Text you type here is sent to an AI provider to answer you; CostCalc does not keep it on a server.",
    roman: "History sirf aapke apne browser mein save hoti hai. Yahan likha text jawab ke liye AI provider ko jata hai; CostCalc usay server par store nahi karta.",
    urdu: "آپ کی ہسٹری صرف آپ کے اپنے براؤزر میں محفوظ ہوتی ہے۔ یہاں لکھا گیا متن جواب کے لیے AI پرووائیڈر کو جاتا ہے؛ CostCalc اسے سرور پر محفوظ نہیں کرتا۔",
  },
  {
    keys: ["quotation", "pdf", "download", "print", "quote", "کوٹیشن", "پی ڈی ایف"],
    en: "After the estimate, open the quotation, edit quantities and rates, then use Download PDF (it uses your browser's print-to-PDF). It is valid for 30 days.",
    roman: "Estimate ke baad quotation kholein, quantity/rate edit karein, phir Download PDF dabayein (browser ka print-to-PDF). Ye 30 din valid hota hai.",
    urdu: "اندازے کے بعد کوٹیشن کھولیں، مقدار اور ریٹ ایڈٹ کریں، پھر Download PDF دبائیں (براؤزر کا print-to-PDF)۔ یہ 30 دن کے لیے درست ہے۔",
  },
  {
    keys: ["offline", "internet", "no internet", "net nahi", "without internet", "آف لائن", "انٹرنیٹ"],
    en: "You can keep using CostCalc without internet: the price engine and quotation work fully offline, saved answers are reused, and the estimate uses built-in data for ~100 countries and common business types.",
    roman: "Internet ke bagair bhi CostCalc chalta hai: price engine aur quotation poora offline kaam karte hain, pehle diye jawab dobara use hote hain, aur estimate ~100 countries aur common business types ke built-in data se banta hai.",
    urdu: "انٹرنیٹ کے بغیر بھی CostCalc چلتا رہتا ہے: قیمت کا انجن اور کوٹیشن مکمل آف لائن کام کرتے ہیں، پچھلے جوابات دوبارہ استعمال ہوتے ہیں، اور اندازہ ~100 ممالک اور عام بزنس اقسام کے بلٹ اِن ڈیٹا سے بنتا ہے۔",
  },
  {
    keys: ["size", "focused", "standard", "complex", "quality", "essential", "premium", "سائز", "کوالٹی"],
    en: "Size: Focused (small scope), Standard (usual features), Complex (larger, advanced). Quality: Essential (budget), Standard (balance), Premium (more polish and scale). Both change the price and timeline.",
    roman: "Size: Focused (chhota scope), Standard (aam features), Complex (bara, advanced). Quality: Essential (budget), Standard (balance), Premium (zyada polish aur scale). Dono price aur timeline badalte hain.",
    urdu: "سائز: Focused (چھوٹا دائرہ)، Standard (عام فیچرز)، Complex (بڑا اور جدید)۔ کوالٹی: Essential (بجٹ)، Standard (توازن)، Premium (زیادہ پالش اور اسکیل)۔ دونوں قیمت اور ٹائم لائن بدلتے ہیں۔",
  },
  {
    keys: ["hello", "hi", "salam", "assalam", "hey", "good morning", "سلام", "السلام علیکم"],
    en: "Hi! Tell me what you want to build and I'll prepare a clear brief for a cost estimate.",
    roman: "Assalam o alaikum! Batayein aap kya banana chahte hain, main estimate ke liye tayyar kar deta hun.",
    urdu: "السلام علیکم! بتائیں آپ کیا بنانا چاہتے ہیں، میں اندازے کے لیے تیار کر دیتا ہوں۔",
  },
  {
    keys: ["thanks", "thank you", "shukriya", "shukria", "شکریہ"],
    en: "You're welcome! Ask anytime you want another estimate.",
    roman: "Khush rahein! Jab chahein dobara estimate ke liye pooch lein.",
    urdu: "خوش رہیں! جب چاہیں دوبارہ اندازے کے لیے پوچھ لیں۔",
  },
];
