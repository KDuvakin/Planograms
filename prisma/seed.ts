import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaMssql } from "@prisma/adapter-mssql";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaMssql({
  server: process.env.DB_HOST!,
  port: Number(process.env.DB_PORT) || 1433,
  database: process.env.DB_NAME!,
  user: process.env.DB_USER!,
  password: process.env.DB_PASSWORD!,
  options: { encrypt: true, trustServerCertificate: true },
});
const prisma = new PrismaClient({ adapter });

const CATEGORIES: {
  name: string;
  nameEn: string;
  nameEt: string;
  nameLv: string;
  icon: string;
  nodePrefix: string | null;
}[] = [
  { name: "Скоропорт", nameEn: "Fresh food", nameEt: "Värske toit", nameLv: "Svaigie produkti", icon: "🥩", nodePrefix: null },
  { name: "Заморозка", nameEn: "Deep-frozen food", nameEt: "Külmutatud toit", nameLv: "Saldēti produkti", icon: "❄️", nodePrefix: null },
  { name: "Бакалея", nameEn: "Groceries", nameEt: "Toidukaubad", nameLv: "Pārtikas preces", icon: "🌾", nodePrefix: null },
  { name: "Алкоголь и табак", nameEn: "Alcohol and tobacco", nameEt: "Alkohol ja tubakas", nameLv: "Alkohols un tabaka", icon: "🍷", nodePrefix: null },
  { name: "Детские товары", nameEn: "Baby products", nameEt: "Lastekaubad", nameLv: "Bērnu preces", icon: "🍼", nodePrefix: null },
  { name: "Товары для домашних питомцев", nameEn: "Pet products", nameEt: "Lemmikloomakaubad", nameLv: "Mājdzīvnieku preces", icon: "🐾", nodePrefix: null },
  { name: "Товары первой необходимости", nameEn: "Basic commodities", nameEt: "Esmatarbekaubad", nameLv: "Pamatpreces", icon: "🧻", nodePrefix: null },
  { name: "Хозяйственные товары", nameEn: "Household products", nameEt: "Majapidamiskaubad", nameLv: "Mājsaimniecības preces", icon: "🔧", nodePrefix: null },
  { name: "Цветы и растения", nameEn: "Plants and plant care products", nameEt: "Taimed ja taimehooldus", nameLv: "Augi un augu kopšana", icon: "💐", nodePrefix: null },
  { name: "Прочее", nameEn: "Other", nameEt: "Muu", nameLv: "Cits", icon: "📦", nodePrefix: null },
];

// Full Group -> Node -> name mapping from the retailer's own category tree (categories.csv).
// `name` is Russian (the app's primary operating language) translated from the source
// Estonian; `nameEt` is the exact source text, kept verbatim.
const NODES: { code: string; name: string; nameEn: string; nameEt: string; nameLv: string; categoryName: string }[] = [
  // Скоропорт (Fresh food)
  { code: "B01A", name: "Фрукты, овощи в холодильнике", nameEn: "Fruits, vegetables in fridge", nameEt: "Puu-,köögiviljad külmikus", nameLv: "Augļi, dārzeņi ledusskapī", categoryName: "Скоропорт" },
  { code: "B01B", name: "Фрукты, овощи на стеллаже", nameEn: "Fruits, vegetables on rack", nameEt: "Puu-, köögiviljad kaldalusel", nameLv: "Augļi, dārzeņi plauktā", categoryName: "Скоропорт" },
  { code: "B02A", name: "Молочные продукты, маргарин", nameEn: "Dairy products, margarine", nameEt: "Piimatooted,margariin", nameLv: "Piena produkti, margarīns", categoryName: "Скоропорт" },
  { code: "B02B", name: "Молочные продукты (доп. витрина)", nameEn: "Dairy products (extra display)", nameEt: "Piimatooted MV", nameLv: "Piena produkti (papildu)", categoryName: "Скоропорт" },
  { code: "B02C", name: "Молочные продукты, УВТ", nameEn: "Dairy products, UHT", nameEt: "Piimatooted, UHT", nameLv: "Piena produkti, UHT", categoryName: "Скоропорт" },
  { code: "B04A", name: "Кондитерские изделия (осн. полка)", nameEn: "Confectionery (main shelf)", nameEt: "Kondiitritooted MP", nameLv: "Konditorejas izstrādājumi (galvenais)", categoryName: "Скоропорт" },
  { code: "B05", name: "Кулинария", nameEn: "Deli products", nameEt: "Kulinaartooted", nameLv: "Kulinārijas izstrādājumi", categoryName: "Скоропорт" },
  { code: "B05A", name: "Кулинария (осн. полка)", nameEn: "Deli products (main shelf)", nameEt: "Kulinaartooted MP", nameLv: "Kulinārijas izstrādājumi (galvenais)", categoryName: "Скоропорт" },
  { code: "B05B", name: "Кулинария (доп. витрина)", nameEn: "Deli products (extra display)", nameEt: "Kulinaartooted MV", nameLv: "Kulinārijas izstrādājumi (papildu)", categoryName: "Скоропорт" },
  { code: "B05D", name: "Соки (холодильник)", nameEn: "Juices (fridge)", nameEt: "Mahlad.Kadarbiku külmikud", nameLv: "Sulas (ledusskapis)", categoryName: "Скоропорт" },
  { code: "B07A", name: "Мясные изделия (осн. полка)", nameEn: "Meat products (main shelf)", nameEt: "Lihatooted MP", nameLv: "Gaļas izstrādājumi (galvenais)", categoryName: "Скоропорт" },
  { code: "B07B", name: "Прилавок мясных изделий", nameEn: "Meat products counter", nameEt: "Lihatoodete lett", nameLv: "Gaļas izstrādājumu lete", categoryName: "Скоропорт" },
  { code: "B07C", name: "Вяленое мясо/сушёная рыба", nameEn: "Cured meat/dried fish", nameEt: "Vinnutatud liha/kuivatud kala", nameLv: "Žāvēta gaļa/žāvēta zivs", categoryName: "Скоропорт" },
  { code: "B07D", name: "Мясные изделия (специальные)", nameEn: "Meat products (special)", nameEt: "Lihatooted eriline", nameLv: "Gaļas izstrādājumi (īpaši)", categoryName: "Скоропорт" },
  { code: "B07E", name: "Стенд Tarczynski", nameEn: "Tarczynski stand", nameEt: "Tarczynski stend", nameLv: "Tarczynski stends", categoryName: "Скоропорт" },
  { code: "B08", name: "Свежее мясо", nameEn: "Fresh meat", nameEt: "Värske liha", nameLv: "Svaiga gaļa", categoryName: "Скоропорт" },
  { code: "B08A", name: "Свежее мясо (осн. полка)", nameEn: "Fresh meat (main shelf)", nameEt: "Värske liha MP", nameLv: "Svaiga gaļa (galvenais)", categoryName: "Скоропорт" },
  { code: "B08B", name: "Свежее мясо (доп. витрина)", nameEn: "Fresh meat (extra display)", nameEt: "Värske liha MV", nameLv: "Svaiga gaļa (papildu)", categoryName: "Скоропорт" },
  { code: "B11", name: "Свежая рыба", nameEn: "Fresh fish", nameEt: "Värske kala", nameLv: "Svaiga zivs", categoryName: "Скоропорт" },
  { code: "B12A", name: "Рыба, рыбные изделия", nameEn: "Fish, fish products", nameEt: "Kala, kalatooted", nameLv: "Zivis, zivju izstrādājumi", categoryName: "Скоропорт" },
  { code: "B12B", name: "Сушёная рыба", nameEn: "Dried fish", nameEt: "Kuivatatud kala", nameLv: "Žāvēta zivs", categoryName: "Скоропорт" },
  { code: "B12C", name: "Прилавок рыбных изделий", nameEn: "Fish products counter", nameEt: "Kalatoodete lett", nameLv: "Zivju izstrādājumu lete", categoryName: "Скоропорт" },
  { code: "B13", name: "Яйца", nameEn: "Eggs", nameEt: "Munad", nameLv: "Olas", categoryName: "Скоропорт" },
  { code: "B14", name: "Упакованный хлеб и сдоба", nameEn: "Packaged bread and pastries", nameEt: "Pakitud leiva- ja saiatooted", nameLv: "Iepakota maize un konditorejas izstrādājumi", categoryName: "Скоропорт" },
  { code: "B15A", name: "Неупакованный хлеб (осн. полка)", nameEn: "Unpackaged bread (main shelf)", nameEt: "Pakkimata leivatooted MP", nameLv: "Neiepakota maize (galvenais)", categoryName: "Скоропорт" },
  { code: "B15B", name: "Неупакованный хлеб (доп. витрина)", nameEn: "Unpackaged bread (extra display)", nameEt: "Pakkimata leivatooted MV", nameLv: "Neiepakota maize (papildu)", categoryName: "Скоропорт" },
  { code: "B16A", name: "Развесная сдоба (осн. полка)", nameEn: "Loose pastries (main shelf)", nameEt: "Lahtised saiakesed MP", nameLv: "Vaļējas konditorejas preces (galvenais)", categoryName: "Скоропорт" },
  { code: "B16B", name: "Развесная сдоба (доп. витрина)", nameEn: "Loose pastries (extra display)", nameEt: "Lahtised saiakesed MV", nameLv: "Vaļējas konditorejas preces (papildu)", categoryName: "Скоропорт" },
  { code: "B17A", name: "Веганские продукты (осн. полка)", nameEn: "Vegan products (main shelf)", nameEt: "Vegantooted MP", nameLv: "Vegāniskie produkti (galvenais)", categoryName: "Скоропорт" },
  { code: "B17B", name: "Веганские продукты (доп. витрина)", nameEn: "Vegan products (extra display)", nameEt: "Vegantooted MV", nameLv: "Vegāniskie produkti (papildu)", categoryName: "Скоропорт" },

  // Заморозка (Deep-frozen food)
  { code: "B30A", name: "Замороженная рыба и рыбопродукты", nameEn: "Frozen fish and fish products", nameEt: "Külmutatud kala ja kalatooted", nameLv: "Saldēta zivs un zivju produkti", categoryName: "Заморозка" },
  { code: "B30B", name: "Зам. овощи, фрукты, ягоды, грибы", nameEn: "Frozen vegetables, fruits, berries, mushrooms", nameEt: "Külm. köögivil., puuvil., marjad, seened", nameLv: "Saldēti dārzeņi, augļi, ogas, sēnes", categoryName: "Заморозка" },
  { code: "B30C", name: "Замороженное мясо и птица", nameEn: "Frozen meat and poultry", nameEt: "Külmutatud liha ja linnuliha", nameLv: "Saldēta gaļa un putnu gaļa", categoryName: "Заморозка" },
  { code: "B31A", name: "Замороженная кулинария", nameEn: "Frozen deli products", nameEt: "Külmutatud kulinaaria", nameLv: "Saldēti kulinārijas izstrādājumi", categoryName: "Заморозка" },
  { code: "B31B", name: "Замороженный хлеб, кондитерские изделия", nameEn: "Frozen bread, confectionery", nameEt: "Külmutatud leib, kondiitritooted", nameLv: "Saldēta maize, konditorejas izstrādājumi", categoryName: "Заморозка" },
  { code: "B32A", name: "Мороженое", nameEn: "Ice cream", nameEt: "Jäätised", nameLv: "Saldējums", categoryName: "Заморозка" },
  { code: "B32B1", name: "Доп. морозильник Unilever", nameEn: "Extra freezer Unilever", nameEt: "Lisakulmik Uniliver", nameLv: "Papildu saldētava Unilever", categoryName: "Заморозка" },
  { code: "B32B2", name: "Доп. морозильник Balbiino", nameEn: "Extra freezer Balbiino", nameEt: "Lisakulmik Balbiino", nameLv: "Papildu saldētava Balbiino", categoryName: "Заморозка" },
  { code: "B32B3", name: "Доп. морозильник Premia", nameEn: "Extra freezer Premia", nameEt: "Lisakulmik Premia", nameLv: "Papildu saldētava Premia", categoryName: "Заморозка" },
  { code: "B32B4", name: "Доп. морозильник MAGNUM", nameEn: "Extra freezer MAGNUM", nameEt: "Lisakulmik MAGNUM", nameLv: "Papildu saldētava MAGNUM", categoryName: "Заморозка" },
  { code: "B32B5", name: "Доп. морозильник Bimar", nameEn: "Extra freezer Bimar", nameEt: "Lisakülmik Bimar", nameLv: "Papildu saldētava Bimar", categoryName: "Заморозка" },
  { code: "B32B6", name: "Доп. морозильник Vikeda", nameEn: "Extra freezer Vikeda", nameEt: "Lisakülmik Vikeda", nameLv: "Papildu saldētava Vikeda", categoryName: "Заморозка" },

  // Бакалея (Groceries)
  { code: "B03", name: "Майонез", nameEn: "Mayonnaise", nameEt: "Majonees", nameLv: "Majonēze", categoryName: "Бакалея" },
  { code: "B40", name: "Чай", nameEn: "Tea", nameEt: "Tee", nameLv: "Tēja", categoryName: "Бакалея" },
  { code: "B41", name: "Кофе", nameEn: "Coffee", nameEt: "Kohv", nameLv: "Kafija", categoryName: "Бакалея" },
  { code: "B42A", name: "Упакованные сладости", nameEn: "Packaged sweets", nameEt: "Pakendatud maiustused", nameLv: "Iepakoti saldumi", categoryName: "Бакалея" },
  { code: "B42B", name: "Развесные сладости", nameEn: "Loose sweets", nameEt: "Lahtised maiustused", nameLv: "Vaļēji saldumi", categoryName: "Бакалея" },
  { code: "B43A", name: "Кукуруза (снеки)", nameEn: "Corn (snacks)", nameEt: "Mais", nameLv: "Kukurūza (uzkodas)", categoryName: "Бакалея" },
  { code: "B43B", name: "Упакованное печенье, пряники и бублики", nameEn: "Packaged cookies, gingerbread and pretzels", nameEt: "Pakendatud küpsised, präänikud ja rõngik", nameLv: "Iepakoti cepumi, piparkūkas un kliņģeri", categoryName: "Бакалея" },
  { code: "B43C", name: "Прочее печенье", nameEn: "Other cookies", nameEt: "Muud Küpsised", nameLv: "Citi cepumi", categoryName: "Бакалея" },
  { code: "B43D", name: "Сухарики и гриссини", nameEn: "Crackers and breadsticks", nameEt: "Kuivikud ja grissinid", nameLv: "Sausiņi un grisīni", categoryName: "Бакалея" },
  { code: "B44", name: "Картофельные и прочие чипсы", nameEn: "Potato chips and other chips", nameEt: "Kartulikrõpsud ja muud krõpsud", nameLv: "Kartupeļu čipsi un citi čipsi", categoryName: "Бакалея" },
  { code: "B45A", name: "Орехи, сухофрукты (упакованные)", nameEn: "Nuts, dried fruits (packaged)", nameEt: "Pähklid, kuivatatud puuviljad (pakitud)", nameLv: "Rieksti, žāvēti augļi (iepakoti)", categoryName: "Бакалея" },
  { code: "B45B", name: "Орехи, сухофрукты (на развес)", nameEn: "Nuts, dried fruits (loose)", nameEt: "Pähklid, kuivatatud puuviljad (kaalu)", nameLv: "Rieksti, žāvēti augļi (svarā)", categoryName: "Бакалея" },
  { code: "B46A", name: "Хлопья, каши, злаковые батончики", nameEn: "Cereals, porridges, cereal bars", nameEt: "Hommikuhelbed, pudrud, teraviljabatoonid", nameLv: "Pārslas, putras, graudaugu batoniņi", categoryName: "Бакалея" },
  { code: "B46B", name: "Сахар, соль", nameEn: "Sugar, salt", nameEt: "Suhkur, sool", nameLv: "Cukurs, sāls", categoryName: "Бакалея" },
  { code: "B46C", name: "Мука", nameEn: "Flour", nameEt: "Jahu", nameLv: "Milti", categoryName: "Бакалея" },
  { code: "B46D", name: "Макароны", nameEn: "Pasta", nameEt: "Pasta", nameLv: "Makaroni", categoryName: "Бакалея" },
  { code: "B46E", name: "Крупы", nameEn: "Groats", nameEt: "Kruubid", nameLv: "Graudaugi", categoryName: "Бакалея" },
  { code: "B46F", name: "Сахар и соль на паллете", nameEn: "Sugar and salt on pallet", nameEt: "Suhkur ja sool kaubaalusel", nameLv: "Cukurs un sāls uz paletes", categoryName: "Бакалея" },
  { code: "B46G", name: "Мука на паллете", nameEn: "Flour on pallet", nameEt: "Jahu kaubaalusel", nameLv: "Milti uz paletes", categoryName: "Бакалея" },
  { code: "B47A", name: "Супы, бульоны", nameEn: "Soups, broths", nameEt: "Supid, puljongid", nameLv: "Zupas, buljoni", categoryName: "Бакалея" },
  { code: "B47B", name: "Желе, кисель", nameEn: "Jelly, kissel", nameEt: "Želee, kissell", nameLv: "Želeja, ķīselis", categoryName: "Бакалея" },
  { code: "B47C", name: "Приправы", nameEn: "Seasonings", nameEt: "Maitseained", nameLv: "Garšvielas", categoryName: "Бакалея" },
  { code: "B47D", name: "Мясные консервы", nameEn: "Canned meat", nameEt: "Lihakonservid", nameLv: "Gaļas konservi", categoryName: "Бакалея" },
  { code: "B47E", name: "Рыбные консервы", nameEn: "Canned fish", nameEt: "Kalakonservid", nameLv: "Zivju konservi", categoryName: "Бакалея" },
  { code: "B48A", name: "Консервированные овощи и фрукты", nameEn: "Canned fruits and vegetables", nameEt: "Konserveeritud puu- ja köögiviljad", nameLv: "Konservēti augļi un dārzeņi", categoryName: "Бакалея" },
  { code: "B48B", name: "Соусы", nameEn: "Sauces", nameEt: "Kastmed", nameLv: "Mērces", categoryName: "Бакалея" },
  { code: "B48D", name: "Масло, уксус", nameEn: "Oil, vinegar", nameEt: "Õli, äädikas", nameLv: "Eļļa, etiķis", categoryName: "Бакалея" },
  { code: "B49", name: "Экопродукты и здоровое питание", nameEn: "Eco and healthy food", nameEt: "Ökotoit ja tervislik toit", nameLv: "Bioprodukti un veselīgs uzturs", categoryName: "Бакалея" },
  { code: "B50", name: "Национальные кухни", nameEn: "National cuisines", nameEt: "Rahvusköögid", nameLv: "Nacionālās virtuves", categoryName: "Бакалея" },
  { code: "B80A", name: "Вода", nameEn: "Water", nameEt: "Vesi", nameLv: "Ūdens", categoryName: "Бакалея" },
  { code: "B80B", name: "Безалкогольные напитки", nameEn: "Soft drinks", nameEt: "Karastusjoogid", nameLv: "Bezalkoholiskie dzērieni", categoryName: "Бакалея" },
  { code: "B80C", name: "Соки на полке", nameEn: "Juices on shelf", nameEt: "Mahlad-riiulis", nameLv: "Sulas plauktā", categoryName: "Бакалея" },
  { code: "B80Y", name: "Напитки в холодильнике на полке", nameEn: "Drinks in fridge, on shelf", nameEt: "Joogid külmikus, riiulil", nameLv: "Dzērieni ledusskapī, plauktā", categoryName: "Бакалея" },
  { code: "B80P", name: "Холодильник Vichy 60см", nameEn: "Vichy fridge 60cm", nameEt: "Vichy külmik 60cm", nameLv: "Vichy ledusskapis 60cm", categoryName: "Бакалея" },
  { code: "B80Q", name: "Холодильник Nestea 60см", nameEn: "Nestea fridge 60cm", nameEt: "Nestea külmik 60cm", nameLv: "Nestea ledusskapis 60cm", categoryName: "Бакалея" },
  { code: "B80S", name: "Холодильник A. Le Coq 60см", nameEn: "A. Le Coq fridge 60cm", nameEt: "Alecoq külmik 60cm", nameLv: "A. Le Coq ledusskapis 60cm", categoryName: "Бакалея" },
  { code: "B80T", name: "Напитки на стеллаже, на поддоне", nameEn: "Drinks on rack, on pallet", nameEt: "Joogid stellaažis, alusel", nameLv: "Dzērieni plauktā, uz paletes", categoryName: "Бакалея" },
  { code: "B80U1", name: "Холодильник Coca-Cola одностворчатый (60)", nameEn: "Coca-Cola single-door fridge (60)", nameEt: "Coca-Cola üheukseline külmik (60)", nameLv: "Coca-Cola vienu durvju ledusskapis (60)", categoryName: "Бакалея" },
  { code: "B80U2", name: "Холодильник Coca-Cola двустворчатый (120)", nameEn: "Coca-Cola double-door fridge (120)", nameEt: "Coca-Cola kaheukseline külmik (120)", nameLv: "Coca-Cola divu durvju ledusskapis (120)", categoryName: "Бакалея" },
  { code: "B80V", name: "Холодильник Red Bull", nameEn: "Red Bull fridge", nameEt: "Red Bull külmik", nameLv: "Red Bull ledusskapis", categoryName: "Бакалея" },
  { code: "B80W", name: "Напитки в холодильнике, на поддоне", nameEn: "Drinks in fridge, on pallet", nameEt: "Joogid külmikus, alusel", nameLv: "Dzērieni ledusskapī, uz paletes", categoryName: "Бакалея" },
  { code: "B80X", name: "Вода на поддоне", nameEn: "Water on pallet", nameEt: "Vesi kaubaalusel", nameLv: "Ūdens uz paletes", categoryName: "Бакалея" },
  { code: "B80Z", name: "Безалкогольные напитки на поддоне", nameEn: "Soft drinks on pallet", nameEt: "Karastusjoogid kaubaalusel", nameLv: "Bezalkoholiskie dzērieni uz paletes", categoryName: "Бакалея" },

  // Алкоголь и табак (Alcohol and tobacco)
  { code: "B81B", name: "Пиво в холодильнике (EE)", nameEn: "Beer in fridge (EE)", nameEt: "Õlu külmikus (EE)", nameLv: "Alus ledusskapī (EE)", categoryName: "Алкоголь и табак" },
  { code: "B81M", name: "Пиво на полке", nameEn: "Beer on shelf", nameEt: "Õlu riiulis", nameLv: "Alus plauktā", categoryName: "Алкоголь и табак" },
  { code: "B81N", name: "Паллеты алкогольных напитков", nameEn: "Alcoholic drinks pallets", nameEt: "Alkohoolsete jookide kaubaalused", nameLv: "Alkoholisko dzērienu paletes", categoryName: "Алкоголь и табак" },
  { code: "B81Q1", name: "Пиво Saku 120см", nameEn: "Saku beer 120cm", nameEt: "Õlu Saku 120cm", nameLv: "Saku alus 120cm", categoryName: "Алкоголь и табак" },
  { code: "B81Q2", name: "Пиво Saku 60", nameEn: "Saku beer 60", nameEt: "Õlu Saku 60", nameLv: "Saku alus 60", categoryName: "Алкоголь и табак" },
  { code: "B81Q3", name: "Пиво A. Le Coq 120см", nameEn: "A. Le Coq beer 120cm", nameEt: "Õlu Alecoq 120cm", nameLv: "A. Le Coq alus 120cm", categoryName: "Алкоголь и табак" },
  { code: "B81Q4", name: "Пиво A. Le Coq 60см", nameEn: "A. Le Coq beer 60cm", nameEt: "Õlu Alecoq 60cm", nameLv: "A. Le Coq alus 60cm", categoryName: "Алкоголь и табак" },
  { code: "B81Q6", name: "Пиво Tanker 60см", nameEn: "Tanker beer 60cm", nameEt: "Õlu Tanker 60cm", nameLv: "Tanker alus 60cm", categoryName: "Алкоголь и табак" },
  { code: "B81Q8", name: "Холодильник Heineken 60см", nameEn: "Heineken fridge 60cm", nameEt: "Heineken külmik 60cm", nameLv: "Heineken ledusskapis 60cm", categoryName: "Алкоголь и табак" },
  { code: "B82A", name: "Сидр и алкогольные коктейли", nameEn: "Cider and alcoholic cocktails", nameEt: "Siider ja alkoholikokteilid", nameLv: "Sidrs un alkoholiskie kokteiļi", categoryName: "Алкоголь и табак" },
  { code: "B82B", name: "Крепкий алкоголь", nameEn: "Strong alcoholic drinks", nameEt: "Kanged alkohoolsed joogid", nameLv: "Stiprie alkoholiskie dzērieni", categoryName: "Алкоголь и табак" },
  { code: "B82C", name: "Вина", nameEn: "Wines", nameEt: "Veinid", nameLv: "Vīni", categoryName: "Алкоголь и табак" },
  { code: "B82X", name: "Вина в холодильнике", nameEn: "Wines in fridge", nameEt: "Veinid külmikus", nameLv: "Vīni ledusskapī", categoryName: "Алкоголь и табак" },
  { code: "B83A", name: "Безалк. напитки на полке (пиво, вино и т.д.)", nameEn: "Non-alc drinks on shelf (beer, wine, etc.)", nameEt: "Alk.vabad joogid riiulis (õlu, vein,jne)", nameLv: "Bezalkoholiskie dzērieni plauktā (alus, vīns u.c.)", categoryName: "Алкоголь и табак" },
  { code: "B90B", name: "Сигареты", nameEn: "Cigarettes", nameEt: "Sigaretid", nameLv: "Cigaretes", categoryName: "Алкоголь и табак" },
  { code: "B90C", name: "Электронные сигареты и аксессуары", nameEn: "Electronic cigarettes and accessories", nameEt: "Elektroonilised sigaretid ja tarvikud", nameLv: "Elektroniskās cigaretes un piederumi", categoryName: "Алкоголь и табак" },

  // Детские товары (Baby products)
  { code: "BA0", name: "Детское питание", nameEn: "Baby food", nameEt: "Beebitoit", nameLv: "Bērnu pārtika", categoryName: "Детские товары" },
  { code: "BA1", name: "Детские подгузники", nameEn: "Baby diapers", nameEt: "Beebimähkmed", nameLv: "Bērnu autiņbiksītes", categoryName: "Детские товары" },
  { code: "BA2A", name: "Товары для малышей", nameEn: "Baby products", nameEt: "Beebitooted", nameLv: "Bērnu preces", categoryName: "Детские товары" },
  { code: "BA2B", name: "Детская косметика 0-2 года", nameEn: "Baby cosmetics 0-2y", nameEt: "Beebikosmeetika 0-2a", nameLv: "Bērnu kosmētika 0-2g", categoryName: "Детские товары" },

  // Товары для домашних питомцев (Pet products)
  { code: "BB0", name: "Корм и товары по уходу за питомцами", nameEn: "Pet food and care products", nameEt: "Lemmikloomatoit ja hooldustooted", nameLv: "Mājdzīvnieku barība un kopšanas līdzekļi", categoryName: "Товары для домашних питомцев" },
  { code: "BB1A", name: "Товары для питомцев (осн. полка)", nameEn: "Pet products (main shelf)", nameEt: "Lemmikloomakaubad ja - tarvikud MP", nameLv: "Mājdzīvnieku preces (galvenais)", categoryName: "Товары для домашних питомцев" },
  { code: "BB1B", name: "Товары для питомцев (доп. витрина)", nameEn: "Pet products (extra display)", nameEt: "Lemmikloomakaubad ja - tarvikud MV", nameLv: "Mājdzīvnieku preces (papildu)", categoryName: "Товары для домашних питомцев" },

  // Товары первой необходимости (Basic commodities, non-food items)
  { code: "BC0", name: "Бытовая химия", nameEn: "Household chemicals", nameEt: "Kodukeemiakaubad", nameLv: "Sadzīves ķīmija", categoryName: "Товары первой необходимости" },
  { code: "BC1A", name: "Бумажные изделия", nameEn: "Paper products", nameEt: "Paberitooted", nameLv: "Papīra izstrādājumi", categoryName: "Товары первой необходимости" },
  { code: "BC2B9", name: "Косметика", nameEn: "Cosmetics", nameEt: "Kosmeetika", nameLv: "Kosmētika", categoryName: "Товары первой необходимости" },
  { code: "BC3", name: "Женские гигиенические товары", nameEn: "Women's hygiene products", nameEt: "Naiste hügieenitooted", nameLv: "Sieviešu higiēnas preces", categoryName: "Товары первой необходимости" },

  // Хозяйственные товары (Household products)
  { code: "BE0", name: "Декор, свечи, бумажные салфетки", nameEn: "Decor, candles, paper napkins", nameEt: "Dekoor, küünlad, pabersalvrätikud", nameLv: "Dekors, sveces, papīra salvetes", categoryName: "Хозяйственные товары" },
  { code: "BE0B", name: "Ароматические палочки", nameEn: "Incense sticks", nameEt: "Lõhnapulgad", nameLv: "Aromātiskie kociņi", categoryName: "Хозяйственные товары" },
  { code: "BE1A", name: "Тарелки, чашки, кофейники", nameEn: "Plates, cups, coffee pots", nameEt: "Taldrikud, tassid, kohvikannud", nameLv: "Šķīvji, krūzes, kafijas kannas", categoryName: "Хозяйственные товары" },
  { code: "BE1C", name: "Кухонная посуда, приборы, материалы", nameEn: "Kitchenware, utensils, materials", nameEt: "Kööginõud, söögiriistad, materjalid", nameLv: "Virtuves piederumi, galda piederumi, materiāli", categoryName: "Хозяйственные товары" },
  { code: "BE2", name: "Хозяйственные товары", nameEn: "Household supplies", nameEt: "Majapidamistarbed", nameLv: "Mājsaimniecības preces", categoryName: "Хозяйственные товары" },
  { code: "BE3A", name: "Праздничные аксессуары, упаковка для подарков", nameEn: "Party accessories, gift wrap", nameEt: "Pidulikud aksessuaarid, Kinkepakendid", nameLv: "Svētku aksesuāri, dāvanu iepakojums", categoryName: "Хозяйственные товары" },
  { code: "BF0", name: "Текстиль", nameEn: "Textiles", nameEt: "Tekstiil", nameLv: "Tekstilizstrādājumi", categoryName: "Хозяйственные товары" },
  { code: "BG0A", name: "Мужская одежда", nameEn: "Men's clothing", nameEt: "Meeste riided", nameLv: "Vīriešu apģērbs", categoryName: "Хозяйственные товары" },
  { code: "BG1", name: "Детская одежда", nameEn: "Children's clothing", nameEt: "Laste riided", nameLv: "Bērnu apģērbs", categoryName: "Хозяйственные товары" },
  { code: "BG3A", name: "Мужское белье и пижамы", nameEn: "Men's underwear and sleepwear", nameEt: "Meeste aluspesu ja magamisriided", nameLv: "Vīriešu apakšveļa un guļamvela", categoryName: "Хозяйственные товары" },
  { code: "BG4E", name: "Детские носки и колготки", nameEn: "Children's socks and tights", nameEt: "Laste sokid ja sukkpüksid", nameLv: "Bērnu zeķes un zeķbikses", categoryName: "Хозяйственные товары" },
  { code: "BG5", name: "Галантерея (аксессуары)", nameEn: "Haberdashery (accessories)", nameEt: "Galanteriikaubad (aksessuaarid)", nameLv: "Galantērija (aksesuāri)", categoryName: "Хозяйственные товары" },
  { code: "BG6", name: "Товары для красоты", nameEn: "Beauty accessories", nameEt: "Ilutarvikud", nameLv: "Skaistumkopšanas piederumi", categoryName: "Хозяйственные товары" },
  { code: "BG7", name: "Товары для сауны", nameEn: "Sauna products", nameEt: "Saunatooted", nameLv: "Pirts preces", categoryName: "Хозяйственные товары" },
  { code: "BH3", name: "Тапочки", nameEn: "Slippers", nameEt: "Sussid", nameLv: "Čības", categoryName: "Хозяйственные товары" },
  { code: "BI0A", name: "Игрушки (осн. полка)", nameEn: "Toys (main shelf)", nameEt: "Mänguasjad MP", nameLv: "Rotaļlietas (galvenais)", categoryName: "Хозяйственные товары" },
  { code: "BI0B", name: "Игрушки (доп. витрина)", nameEn: "Toys (extra display)", nameEt: "Mänguasjad MV", nameLv: "Rotaļlietas (papildu)", categoryName: "Хозяйственные товары" },
  { code: "BJ0A", name: "Товары для отдыха и спорта", nameEn: "Leisure and sports products", nameEt: "Vaba aja ja spordikaubad", nameLv: "Brīvā laika un sporta preces", categoryName: "Хозяйственные товары" },
  { code: "BJ2", name: "Грили, средства для розжига", nameEn: "Grills, fire starters", nameEt: "Grillid, süütevahendid", nameLv: "Grili, aizdedzināšanas līdzekļi", categoryName: "Хозяйственные товары" },
  { code: "BK2", name: "Канцтовары", nameEn: "Office supplies", nameEt: "Kontoritarvikud", nameLv: "Biroja preces", categoryName: "Хозяйственные товары" },
  { code: "BK3", name: "Фоторамки, альбомы, часы", nameEn: "Photo frames, albums, clocks", nameEt: "Pildiraamid, albumid, kellad", nameLv: "Foto rāmji, albumi, pulksteņi", categoryName: "Хозяйственные товары" },
  { code: "BL0", name: "Бытовая электротехника", nameEn: "Household electrical appliances", nameEt: "Elektrilised Majapidamisseadmed", nameLv: "Mājsaimniecības elektroierīces", categoryName: "Хозяйственные товары" },
  { code: "BL1", name: "Компьютерные товары", nameEn: "Computer products", nameEt: "Arvutitooted", nameLv: "Datoru preces", categoryName: "Хозяйственные товары" },
  { code: "BL2", name: "Лампочки, батарейки", nameEn: "Light bulbs, batteries", nameEt: "Pirnid, patareid", nameLv: "Spuldzes, baterijas", categoryName: "Хозяйственные товары" },
  { code: "BM0", name: "Автотовары", nameEn: "Car products", nameEt: "Autokaubad", nameLv: "Auto preces", categoryName: "Хозяйственные товары" },
  { code: "BM1", name: "Рабочий и садовый инструмент, инвентарь", nameEn: "Work and garden tools and supplies", nameEt: "Töö-, aiatööriistad ja tarvikud", nameLv: "Darba un dārza instrumenti un piederumi", categoryName: "Хозяйственные товары" },
  { code: "BP1", name: "Удобрения, грунт", nameEn: "Fertilizers, soil", nameEt: "Väetised, Mullad", nameLv: "Mēslojumi, augsne", categoryName: "Хозяйственные товары" },
  { code: "VYB", name: "Доп. выкладка — Well Done", nameEn: "Extra placement — Well Done", nameEt: "Täiendav paigutus - Well Done", nameLv: "Papildu izvietojums — Well Done", categoryName: "Хозяйственные товары" },
  { code: "VYB1", name: "Доп. выкладка — Ценовой лидер", nameEn: "Extra placement — Price leader", nameEt: "Täiendav paigutus - Hinnaliider", nameLv: "Papildu izvietojums — Cenu līderis", categoryName: "Хозяйственные товары" },

  // Цветы и растения (Plants and plant care products)
  { code: "BP01A", name: "Стенд с цветами", nameEn: "Flower stand", nameEt: "Lillede stend", nameLv: "Ziedu stends", categoryName: "Цветы и растения" },
  { code: "BP01B", name: "Наклонный стеллаж с цветами", nameEn: "Flower slanted rack", nameEt: "Lillede kaldriiul", nameLv: "Ziedu slīpais plaukts", categoryName: "Цветы и растения" },
  { code: "BP01C", name: "Подставки для цветов", nameEn: "Flower stands (base)", nameEt: "Lillede alused", nameLv: "Ziedu paliktņi", categoryName: "Цветы и растения" },
  { code: "BP01D", name: "Холодильник для цветов", nameEn: "Flower fridge", nameEt: "Lillede külmik", nameLv: "Ziedu ledusskapis", categoryName: "Цветы и растения" },
  { code: "BP0A1", name: "Стенд Nojus 40см", nameEn: "Nojus stand 40cm", nameEt: "Stend Nojus 40cm", nameLv: "Nojus stends 40cm", categoryName: "Цветы и растения" },
  { code: "BP0A2", name: "Стенд Nojus 60см", nameEn: "Nojus stand 60cm", nameEt: "Stend Nojus 60cm", nameLv: "Nojus stends 60cm", categoryName: "Цветы и растения" },
  { code: "BP0B2", name: "Стенд Kėdainių sėklos 60см", nameEn: "Kėdainių sėklos stand 60cm", nameEt: "Stend Kėdainių sėklos 60cm", nameLv: "Kėdainių sėklos stends 60cm", categoryName: "Цветы и растения" },
  { code: "BP0C1", name: "Стенд Tavo sodyba 40см", nameEn: "Tavo sodyba stand 40cm", nameEt: "Stend Tavo sodyba 40cm", nameLv: "Tavo sodyba stends 40cm", categoryName: "Цветы и растения" },
  { code: "BP0C2", name: "Стенд Tavo sodyba 60см", nameEn: "Tavo sodyba stand 60cm", nameEt: "Stend Tavo sodyba 60cm", nameLv: "Tavo sodyba stends 60cm", categoryName: "Цветы и растения" },
  { code: "BP0D2", name: "Стенд Kurzemes Sēklas 60см", nameEn: "Kurzemes Sēklas stand 60cm", nameEt: "Stend Kurzemes Sēklas 60cm", nameLv: "Kurzemes Sēklas stends 60cm", categoryName: "Цветы и растения" },

  // Прочее (Other)
  { code: "BS0A", name: "Большой стенд у кассы", nameEn: "Large stand at checkout", nameEt: "Suur kaubastend kassa juures", nameLv: "Liels stends pie kases", categoryName: "Прочее" },
  { code: "BS0B", name: "Малый стенд у кассы", nameEn: "Small stand at checkout", nameEt: "Väike kaubastend kassa juures", nameLv: "Mazs stends pie kases", categoryName: "Прочее" },
  { code: "BS0D", name: "Стенд «бабочки» у кассы (большой)", nameEn: "\"Butterfly\" stand at checkout (large)", nameEt: "Liblikate kaubastend kassa juures (Suur)", nameLv: "\"Tauriņu\" stends pie kases (liels)", categoryName: "Прочее" },
  { code: "BS0E", name: "Стенд «бабочки» у кассы (большой)", nameEn: "\"Butterfly\" stand at checkout (large)", nameEt: "Liblikate kaubastend kassa juures (Suur)", nameLv: "\"Tauriņu\" stends pie kases (liels)", categoryName: "Прочее" },
  { code: "BS0F", name: "Стенд самообслуживания у кассы (малый)", nameEn: "Self-service stand at checkout (small)", nameEt: "Iseteen. kaubastend kassa juures (väike)", nameLv: "Pašapkalpošanās stends pie kases (mazs)", categoryName: "Прочее" },
  { code: "BS0H", name: "Стенд жевательной резинки", nameEn: "Chewing gum stand", nameEt: "Närimiskummide kaubastend", nameLv: "Košļājamās gumijas stends", categoryName: "Прочее" },
  { code: "BS0I", name: "Большой стенд самообслуживания", nameEn: "Large self-service stand", nameEt: "Suur Iseteeninduse Kaubastend", nameLv: "Liels pašapkalpošanās stends", categoryName: "Прочее" },
  { code: "BS0I1", name: "Малый стенд самообслуживания", nameEn: "Small self-service stand", nameEt: "Väike Iseteeninduse Kaubastend", nameLv: "Mazs pašapkalpošanās stends", categoryName: "Прочее" },
  { code: "BS0J", name: "Экспресс-стенд у кассы", nameEn: "Express stand at checkout", nameEt: "Ekspress kaubastend kassa juures", nameLv: "Ekspresa stends pie kases", categoryName: "Прочее" },
  { code: "BS3", name: "Кухня гурмана", nameEn: "Gourmet kitchen", nameEt: "Gurmaanide köök", nameLv: "Gardēžu virtuve", categoryName: "Прочее" },
  { code: "BS7A1", name: "Акция на свежие продукты", nameEn: "Promo fresh food", nameEt: "Kampaania värsket toitu", nameLv: "Akcija svaigai pārtikai", categoryName: "Прочее" },
  { code: "BS7A2", name: "Акция на фрукты и овощи", nameEn: "Promo fruits and vegetables", nameEt: "Kampaania puu- ja juurviljad", nameLv: "Akcija augļiem un dārzeņiem", categoryName: "Прочее" },
  { code: "BS7A3", name: "Акция на свежие продукты", nameEn: "Promo fresh food", nameEt: "Kampaania värske toit", nameLv: "Akcija svaigai pārtikai", categoryName: "Прочее" },
  { code: "BS7A4", name: "Промо свежий продукт 4", nameEn: "Promo fresh product 4", nameEt: "Promo värske toode 4", nameLv: "Promo svaigais produkts 4", categoryName: "Прочее" },
  { code: "BS7B", name: "Акционная полка — Газета", nameEn: "Promo shelf — Newspaper", nameEt: "Kampaania riiulid - Ajaleht", nameLv: "Akcijas plaukts — Avīze", categoryName: "Прочее" },
  { code: "BS7B1", name: "Полка акционных товаров 1", nameEn: "Promo products shelf 1", nameEt: "Kampaaniatoodete riiulid 1", nameLv: "Akcijas preču plaukts 1", categoryName: "Прочее" },
  { code: "BS7B2", name: "Полка акционных товаров 2", nameEn: "Promo products shelf 2", nameEt: "Kampaaniatoodete riiulid 2", nameLv: "Akcijas preču plaukts 2", categoryName: "Прочее" },
  { code: "BS7B3", name: "Полка акционных товаров 3", nameEn: "Promo products shelf 3", nameEt: "Kampaaniatoodete riiulid 3", nameLv: "Akcijas preču plaukts 3", categoryName: "Прочее" },
  { code: "BS7B4", name: "Промо-стеллаж 4", nameEn: "Promo bays 4", nameEt: "Promo Bays 4", nameLv: "Promo plaukti 4", categoryName: "Прочее" },
  { code: "BS7B5", name: "Зона LEGO у кассы", nameEn: "LEGO checkout zone", nameEt: "LEGO kassatsoon", nameLv: "LEGO kases zona", categoryName: "Прочее" },
  { code: "BS7B6", name: "Промо замороженных продуктов", nameEn: "Promo frozen food", nameEt: "Promo külmutatud toitu", nameLv: "Promo saldētai pārtikai", categoryName: "Прочее" },
  { code: "BS7B7", name: "Платные стенды поставщика", nameEn: "Supplier-paid stands", nameEt: "Müüja tasulised stendid", nameLv: "Piegādātāja apmaksātie stendi", categoryName: "Прочее" },
  { code: "BS7C", name: "Паллеты акционных товаров", nameEn: "Promo products pallets", nameEt: "Kampaaniatoodete kaubaalused", nameLv: "Akcijas preču paletes", categoryName: "Прочее" },
  { code: "BS7D", name: "Паллеты промоушна — Газета", nameEn: "Promotion pallets — Newspaper", nameEt: "Müügiedenduse kaubaalused - Ajaleht", nameLv: "Reklāmas paletes — Avīze", categoryName: "Прочее" },
  { code: "BS7D1", name: "Паллеты акционных товаров 1", nameEn: "Promo products pallets 1", nameEt: "Kampaaniatoodete kaubaalused 1", nameLv: "Akcijas preču paletes 1", categoryName: "Прочее" },
  { code: "BS7D2", name: "Паллеты акционных товаров 2", nameEn: "Promo products pallets 2", nameEt: "Kampaaniatoodete kaubaalused 2", nameLv: "Akcijas preču paletes 2", categoryName: "Прочее" },
  { code: "BS7D3", name: "Паллеты акционных товаров 3", nameEn: "Promo products pallets 3", nameEt: "Kampaaniatoodete kaubaalused 3", nameLv: "Akcijas preču paletes 3", categoryName: "Прочее" },
  { code: "BS7D4", name: "Паллеты акционных товаров 4", nameEn: "Promo products pallets 4", nameEt: "Kampaaniatoodete kaubaalused 4", nameLv: "Akcijas preču paletes 4", categoryName: "Прочее" },
  { code: "BS7E", name: "Акционные дни — Дни сладостей", nameEn: "Promo days — Sweets days", nameEt: "Kampaaniapäevad  - Maiustuse Päevad", nameLv: "Akcijas dienas — Saldumu dienas", categoryName: "Прочее" },
  { code: "BS7F", name: "Сезонные товары — Рождество 1", nameEn: "Seasonal products — Christmas 1", nameEt: "Hooajaliste toodete kaubaad - Jõulud 1", nameLv: "Sezonas preces — Ziemassvētki 1", categoryName: "Прочее" },
  { code: "BS7G", name: "Непродовольственные зоны", nameEn: "Non-food zones", nameEt: "Non-Food Tsoonid", nameLv: "Nepārtikas zonas", categoryName: "Прочее" },
  { code: "BS7G1", name: "Зона F2-F3", nameEn: "Zone F2-F3", nameEt: "Tsoon F2-F3", nameLv: "Zona F2-F3", categoryName: "Прочее" },
  { code: "BS7G2", name: "Зона PS", nameEn: "Zone PS", nameEt: "Tsoon PS", nameLv: "Zona PS", categoryName: "Прочее" },
  { code: "BS7G3", name: "Зона Ps1", nameEn: "Zone Ps1", nameEt: "Tsoon Ps1", nameLv: "Zona Ps1", categoryName: "Прочее" },
  { code: "BS7G4", name: "Информационный лист пром. товара", nameEn: "Non-food info sheet", nameEt: "Töösuskauba infoleht", nameLv: "Rūpniecības preces infolapa", categoryName: "Прочее" },
  { code: "BS7H", name: "Сезонные товары — Рождество 2", nameEn: "Seasonal products — Christmas 2", nameEt: "Hooajaliste toodete kaubad - Jõulud 2", nameLv: "Sezonas preces — Ziemassvētki 2", categoryName: "Прочее" },
  { code: "BS7I", name: "Акционные дни — Алко спецпроекты", nameEn: "Promo days — Alco special projects", nameEt: "Kampaaniapäevad Alco eriprojektid", nameLv: "Akcijas dienas — Alkohola īpašie projekti", categoryName: "Прочее" },
  { code: "BS7J", name: "Акционные дни — Дни вина", nameEn: "Promo days — Wine days", nameEt: "Kampaaniapäevad - Veinipäevad", nameLv: "Akcijas dienas — Vīna dienas", categoryName: "Прочее" },
  { code: "BS7J1", name: "Акционные дни — Дни пива", nameEn: "Promo days — Beer days", nameEt: "Kampaaniapäevad - Õllepäevad", nameLv: "Akcijas dienas — Alus dienas", categoryName: "Прочее" },
  { code: "BS7K", name: "Акционные дни — Дни кофе", nameEn: "Promo days — Coffee days", nameEt: "Kampaaniapäevad Kohvipäevad", nameLv: "Akcijas dienas — Kafijas dienas", categoryName: "Прочее" },
  { code: "BS7K1", name: "Зона продажи алкоголя", nameEn: "Alcohol sales area", nameEt: "Alkoholi müügiala", nameLv: "Alkohola tirdzniecības zona", categoryName: "Прочее" },
  { code: "BS7K2", name: "Зона продажи пром. товаров", nameEn: "Non-food sales area", nameEt: "Tööstuskauba müügiala", nameLv: "Rūpniecības preču tirdzniecības zona", categoryName: "Прочее" },
  { code: "BS7K3", name: "Доп. выкладка поставщика 1", nameEn: "Supplier extra placement 1", nameEt: "Tarnija ostetud lisapaigutused 1", nameLv: "Piegādātāja papildu izvietojums 1", categoryName: "Прочее" },
  { code: "BS7K4", name: "Доп. выкладка поставщика 2", nameEn: "Supplier extra placement 2", nameEt: "Tarnija ostetud lisapaigutused 2", nameLv: "Piegādātāja papildu izvietojums 2", categoryName: "Прочее" },
  { code: "BS7K5", name: "Доп. выкладка поставщика 3", nameEn: "Supplier extra placement 3", nameEt: "Tarnija ostetud lisapaigutused 3", nameLv: "Piegādātāja papildu izvietojums 3", categoryName: "Прочее" },
  { code: "BS7K6", name: "Доп. выкладка поставщика 4", nameEn: "Supplier extra placement 4", nameEt: "Tarnija ostetud lisapaigutused 4", nameLv: "Piegādātāja papildu izvietojums 4", categoryName: "Прочее" },
  { code: "BS7K7", name: "Доп. выкладка поставщика 5", nameEn: "Supplier extra placement 5", nameEt: "Tarnija ostetud lisapaigutused 5", nameLv: "Piegādātāja papildu izvietojums 5", categoryName: "Прочее" },
  { code: "BS7K8", name: "Доп. выкладка поставщика 6", nameEn: "Supplier extra placement 6", nameEt: "Tarnija ostetud lisapaigutused 6", nameLv: "Piegādātāja papildu izvietojums 6", categoryName: "Прочее" },
  { code: "BS7K9", name: "Доп. выкладка поставщика 7", nameEn: "Supplier extra placement 7", nameEt: "Tarnija ostetud lisapaigutused 7", nameLv: "Piegādātāja papildu izvietojums 7", categoryName: "Прочее" },
  { code: "BS7KA", name: "Доп. выкладка поставщика 8", nameEn: "Supplier extra placement 8", nameEt: "Tarnija ostetud lisapaigutused 8", nameLv: "Piegādātāja papildu izvietojums 8", categoryName: "Прочее" },
  { code: "BS7KB", name: "Доп. выкладка поставщика 9", nameEn: "Supplier extra placement 9", nameEt: "Tarnija ostetud lisapaigutused 9", nameLv: "Piegādātāja papildu izvietojums 9", categoryName: "Прочее" },
  { code: "BS7KC", name: "Доп. выкладка поставщика 10", nameEn: "Supplier extra placement 10", nameEt: "Tarnija ostetud lisapaigutused 10", nameLv: "Piegādātāja papildu izvietojums 10", categoryName: "Прочее" },
  { code: "BS7L", name: "Акционные дни — Дни любимцев", nameEn: "Promo days — Pet days", nameEt: "Kampaaniapäevad Lemmikute päevad", nameLv: "Akcijas dienas — Mīluļu dienas", categoryName: "Прочее" },
  { code: "BS7M", name: "Акционные дни — Дни красоты", nameEn: "Promo days — Beauty days", nameEt: "Kampaaniapäevad Ilu Mõte", nameLv: "Akcijas dienas — Skaistuma dienas", categoryName: "Прочее" },
  { code: "BS7M1", name: "Акционные дни — Дни чистоты", nameEn: "Promo days — Cleaning days", nameEt: "Kampaaniapäevad Puhastuspäevad", nameLv: "Akcijas dienas — Tīrīšanas dienas", categoryName: "Прочее" },
  { code: "BS7M2", name: "Акционные дни — Дни улыбки", nameEn: "Promo days — Smile days", nameEt: "Kampaaniapäevad Naeratuse päevad", nameLv: "Akcijas dienas — Smaida dienas", categoryName: "Прочее" },
  { code: "BS7M3", name: "Акционные дни — Дни волос", nameEn: "Promo days — Hair days", nameEt: "Kampaaniapäevad Juuksepäevad", nameLv: "Akcijas dienas — Matu dienas", categoryName: "Прочее" },
  { code: "BS7M4", name: "Акционные дни — Дни малышей", nameEn: "Promo days — Baby days", nameEt: "Kampaaniapäevad Beebipäevad", nameLv: "Akcijas dienas — Mazuļu dienas", categoryName: "Прочее" },
  { code: "BS7M5", name: "Акция детских книг", nameEn: "Children's books promo", nameEt: "Lasteraamatute kampaania", nameLv: "Bērnu grāmatu akcija", categoryName: "Прочее" },
  { code: "BS7M6", name: "Промо3", nameEn: "Promo3", nameEt: "Promo3", nameLv: "Promo3", categoryName: "Прочее" },
  { code: "BS7M7", name: "Промо4", nameEn: "Promo4", nameEt: "Promo4", nameLv: "Promo4", categoryName: "Прочее" },
  { code: "BS7MA", name: "Акционные дни — Дни Азии", nameEn: "Promo days — Asia days", nameEt: "Kampaaniapäevad Aasia päevad", nameLv: "Akcijas dienas — Āzijas dienas", categoryName: "Прочее" },
  { code: "BS7MB", name: "Акционные дни — Пасха", nameEn: "Promo days — Easter", nameEt: "Kampaaniapäevad Lihavõtted", nameLv: "Akcijas dienas — Lieldienas", categoryName: "Прочее" },
  { code: "BS7MC", name: "Акционные дни — Дни здоровья и спорта", nameEn: "Promo days — Health and sport days", nameEt: "Kampaaniapäevad Tervislikud päevad ja sp", nameLv: "Akcijas dienas — Veselības un sporta dienas", categoryName: "Прочее" },
  { code: "BS7MD", name: "Акционные дни — Дни европейских вкусов", nameEn: "Promo days — European taste days", nameEt: "Kampaaniapäevad Euroopa maitse päevad", nameLv: "Akcijas dienas — Eiropas garšu dienas", categoryName: "Прочее" },
  { code: "BS7ME", name: "Акционные дни — Янов день (Лиго)", nameEn: "Promo days — Midsummer", nameEt: "Kampaaniapäevad Jaanipäev", nameLv: "Akcijas dienas — Jāņi", categoryName: "Прочее" },
  { code: "BS7MF", name: "Акционные дни — Дни снеков и сладостей", nameEn: "Promo days — Snack and sweets days", nameEt: "Kampaaniapäevad Snäki- ja maiustuste päe", nameLv: "Akcijas dienas — Uzkodu un saldumu dienas", categoryName: "Прочее" },
  { code: "BS7N", name: "Товары программы лояльности", nameEn: "Loyalty program products", nameEt: "Lojaalsuskaubad", nameLv: "Lojalitātes preces", categoryName: "Прочее" },
];

async function main() {
  const store = await prisma.store.upsert({
    where: { code: "DEMO" },
    update: {},
    create: { code: "DEMO", name: "Demo store" },
  });

  // Categories/Nodes are fully defined by the arrays above (the retailer's real category
  // tree) — wipe and recreate rather than reconciling stale rows against the new list.
  // Safe: nothing else references these tables (Planogram.node is a plain string, not an FK).
  await prisma.node.deleteMany({});
  await prisma.category.deleteMany({});

  const categoryIdByName = new Map<string, string>();
  for (const [index, category] of CATEGORIES.entries()) {
    const { name, ...rest } = category;
    const row = await prisma.category.create({
      data: { name, ...rest, sortOrder: index },
    });
    categoryIdByName.set(row.name, row.id);
  }

  for (const { categoryName, ...node } of NODES) {
    const categoryId = categoryIdByName.get(categoryName);
    if (!categoryId) continue;
    await prisma.node.create({ data: { ...node, categoryId } });
  }

  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@planograms.local";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "change-me";
  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      passwordHash,
      name: "Admin",
      role: "ADMIN",
      storeId: store.id,
    },
  });

  console.log(`Seeded store "${store.code}", ${CATEGORIES.length} categories, ${NODES.length} nodes, and admin user "${email}".`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
