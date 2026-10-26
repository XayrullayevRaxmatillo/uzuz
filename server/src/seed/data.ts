import type { CategorySlug, Difficulty, Lang, QuestionInput, TimeLimit } from '@uzuz/shared';

export const CATEGORIES: { slug: CategorySlug; name: Record<Lang, string>; icon: string; color: string }[] = [
  { slug: 'it', name: { uz: 'IT va dasturlash', ru: 'IT и программирование', en: 'IT & Programming' }, icon: '💻', color: '#7C3AED' },
  { slug: 'math', name: { uz: 'Matematika', ru: 'Математика', en: 'Mathematics' }, icon: '➗', color: '#4F46E5' },
  { slug: 'english', name: { uz: 'Ingliz tili', ru: 'Английский язык', en: 'English' }, icon: '🔤', color: '#0EA5E9' },
  { slug: 'science', name: { uz: 'Fan', ru: 'Наука', en: 'Science' }, icon: '🔬', color: '#22C55E' },
  { slug: 'history', name: { uz: 'Tarix', ru: 'История', en: 'History' }, icon: '🏛️', color: '#F59E0B' },
  { slug: 'geography', name: { uz: 'Geografiya', ru: 'География', en: 'Geography' }, icon: '🌍', color: '#14B8A6' },
  { slug: 'general', name: { uz: 'Umumiy bilim', ru: 'Общие знания', en: 'General knowledge' }, icon: '💡', color: '#FF6B6B' }
];

const TF: Record<Lang, [string, string]> = {
  uz: ['To‘g‘ri', 'Noto‘g‘ri'],
  ru: ['Верно', 'Неверно'],
  en: ['True', 'False']
};

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * Single-choice question. `correct` is the index in `options` as written; options are then rotated
 * deterministically (by question text) so the right answer is not always in the same slot.
 */
function q(text: string, options: string[], correct: number, timeLimit: TimeLimit = 20, explanation = ''): QuestionInput {
  const shift = hash(text) % options.length;
  const marked = options.map((o, i) => ({ text: o, correct: i === correct }));
  const rotated = [...marked.slice(shift), ...marked.slice(0, shift)];
  return {
    type: 'single',
    text,
    image: null,
    options: rotated,
    timeLimit,
    points: 'standard',
    explanation
  };
}

function tf(lang: Lang, text: string, isTrue: boolean, explanation = '', timeLimit: TimeLimit = 10): QuestionInput {
  return {
    type: 'boolean',
    text,
    image: null,
    options: [
      { text: TF[lang][0], correct: isTrue },
      { text: TF[lang][1], correct: !isTrue }
    ],
    timeLimit,
    points: 'standard',
    explanation
  };
}

export interface SeedQuiz {
  title: string;
  description: string;
  category: CategorySlug;
  language: Lang;
  difficulty: Difficulty;
  tags: string[];
  featured?: boolean;
  questions: QuestionInput[];
}

export const QUIZZES: SeedQuiz[] = [
  /* ---------------- IT ---------------- */
  {
    title: 'Dasturlash asoslari',
    description: 'HTML, CSS, JavaScript va kompyuter haqidagi eng kerakli tushunchalar.',
    category: 'it',
    language: 'uz',
    difficulty: 'easy',
    tags: ['html', 'css', 'javascript'],
    featured: true,
    questions: [
      q('HTML nimaning qisqartmasi?', ['HyperText Markup Language', 'High Tech Modern Language', 'Hyper Transfer Markup Logic', 'Home Tool Markup Language'], 0),
      q('Quyidagilardan qaysi biri dasturlash tili emas, balki belgilash tili?', ['Python', 'JavaScript', 'HTML', 'Java'], 2, 20, 'HTML sahifa tuzilishini belgilaydi, unda shartlar va sikllar yo‘q.'),
      q('JavaScript’da qat’iy tenglik (tip bilan birga) operatori qaysi?', ['===', '==', '=', '!='], 0, 10),
      q('CSS nima uchun ishlatiladi?', ['Sahifa ko‘rinishi va dizayni uchun', 'Ma’lumotlar bazasi uchun', 'Server mantiqi uchun', 'Operatsion tizim uchun'], 0),
      q('1 bayt necha bitdan iborat?', ['8', '4', '16', '10'], 0, 10),
      tf('uz', 'Git — versiyalarni boshqarish tizimi.', true),
      q('Serverda yangi ma’lumot yaratish uchun odatda qaysi HTTP metodi ishlatiladi?', ['POST', 'GET', 'DELETE', 'HEAD'], 0)
    ]
  },
  {
    title: 'Web dasturlash: React va Node.js',
    description: 'Zamonaviy full-stack: React, Node.js, Express va MongoDB bo‘yicha savollar.',
    category: 'it',
    language: 'uz',
    difficulty: 'medium',
    tags: ['react', 'node', 'mongodb'],
    questions: [
      q('React’da komponent holatini (state) saqlash uchun qaysi hook ishlatiladi?', ['useState', 'useEffect', 'useRef', 'useMemo'], 0),
      q('Node.js qaysi JavaScript dvigateliga asoslangan?', ['V8', 'SpiderMonkey', 'Chakra', 'JavaScriptCore'], 0),
      q('Express.js nima?', ['Node.js uchun veb-freymvork', 'Ma’lumotlar bazasi', 'CSS kutubxonasi', 'Brauzer'], 0),
      q('MongoDB qanday turdagi ma’lumotlar bazasi?', ['Hujjatga yo‘naltirilgan (NoSQL)', 'Relyatsion (SQL)', 'Faqat grafik baza', 'Jadval muharriri'], 0),
      q('HTTP 404 status kodi nimani bildiradi?', ['Resurs topilmadi', 'Server xatosi', 'Ruxsat yo‘q', 'Muvaffaqiyatli'], 0, 10),
      tf('uz', 'TypeScript — JavaScript’ga statik tiplar qo‘shilgan ustki to‘plam.', true)
    ]
  },
  {
    title: 'Computer Science Basics',
    description: 'Hardware, data structures, binary and algorithms — test your CS fundamentals.',
    category: 'it',
    language: 'en',
    difficulty: 'medium',
    tags: ['algorithms', 'cs'],
    questions: [
      q('What does CPU stand for?', ['Central Processing Unit', 'Computer Personal Unit', 'Central Program Utility', 'Core Processing Utility'], 0),
      q('Which data structure follows the LIFO principle?', ['Stack', 'Queue', 'Tree', 'Graph'], 0),
      q('What is the decimal number 10 in binary?', ['1010', '1100', '1001', '0110'], 0),
      q('What is the time complexity of binary search on a sorted array?', ['O(log n)', 'O(n)', 'O(n²)', 'O(1)'], 0),
      q('Who described the theoretical "universal machine" in 1936?', ['Alan Turing', 'Bill Gates', 'Charles Babbage', 'Tim Berners-Lee'], 0, 20, 'Alan Turing described what is now called the Turing machine.'),
      tf('en', 'RAM keeps its data after the computer is switched off.', false, 'RAM is volatile memory: it loses its contents without power.')
    ]
  },

  /* ---------------- Math ---------------- */
  {
    title: 'Tez hisoblash',
    description: 'Og‘zaki hisob-kitob tezligingizni sinab ko‘ring!',
    category: 'math',
    language: 'uz',
    difficulty: 'easy',
    tags: ['hisob', 'tezlik'],
    featured: true,
    questions: [
      q('12 × 12 = ?', ['144', '124', '132', '154'], 0, 10),
      q('81 ning kvadrat ildizi nechaga teng?', ['9', '8', '7', '18'], 0, 10),
      q('200 ning 15 foizi nechaga teng?', ['30', '15', '20', '35'], 0),
      q('Uchburchak ichki burchaklarining yig‘indisi necha gradus?', ['180°', '90°', '360°', '270°'], 0, 10),
      q('7 ning kubi nechaga teng?', ['343', '49', '217', '777'], 0),
      tf('uz', 'Har qanday juft son 2 ga qoldiqsiz bo‘linadi.', true)
    ]
  },
  {
    title: 'Algebra va geometriya',
    description: 'Tenglamalar, formulalar va geometrik shakllar.',
    category: 'math',
    language: 'uz',
    difficulty: 'medium',
    tags: ['algebra', 'geometriya'],
    questions: [
      q('2x + 6 = 14 bo‘lsa, x nechaga teng?', ['4', '3', '5', '8'], 0),
      q('Doira yuzini hisoblash formulasi qaysi?', ['πr²', '2πr', 'πd', 'r²/2'], 0),
      q('To‘g‘ri burchakli uchburchakning katetlari 3 va 4 bo‘lsa, gipotenuza nechaga teng?', ['5', '6', '7', '12'], 0),
      q('Eng kichik tub son qaysi?', ['2', '1', '3', '0'], 0, 10),
      q('(a + b)² ifodasi nimaga teng?', ['a² + 2ab + b²', 'a² + b²', 'a² − 2ab + b²', '2a + 2b'], 0),
      tf('uz', 'π soni ratsional son.', false, 'π — irratsional son, uni oddiy kasr ko‘rinishida yozib bo‘lmaydi.')
    ]
  },
  {
    title: 'Математика и логика',
    description: 'Короткие задачи на счёт, проценты и закономерности.',
    category: 'math',
    language: 'ru',
    difficulty: 'medium',
    tags: ['логика', 'счёт'],
    questions: [
      q('Сколько секунд в одном часе?', ['3600', '360', '6000', '1200'], 0, 10),
      q('Продолжите ряд: 2, 4, 8, 16, …', ['32', '24', '20', '18'], 0, 10),
      q('Чему равно 25% от 80?', ['20', '25', '16', '40'], 0),
      q('Сколько градусов в прямом угле?', ['90', '180', '45', '60'], 0, 10),
      q('Чему равно среднее арифметическое чисел 4, 8 и 12?', ['8', '6', '10', '12'], 0),
      tf('ru', 'Любое число, умноженное на ноль, равно нулю.', true)
    ]
  },

  /* ---------------- English ---------------- */
  {
    title: 'Ingliz tili: so‘z boyligi',
    description: 'Boshlang‘ich darajadagi inglizcha so‘zlar va grammatika.',
    category: 'english',
    language: 'uz',
    difficulty: 'easy',
    tags: ['vocabulary', 'beginner'],
    featured: true,
    questions: [
      q('"Apple" so‘zining tarjimasi qaysi?', ['Olma', 'Nok', 'Uzum', 'Anor'], 0, 10),
      q('"Book" so‘zining ko‘plik shakli qaysi?', ['books', 'bookes', 'bookies', 'book’s'], 0, 10),
      q('"Go" fe’lining o‘tgan zamon shakli qaysi?', ['went', 'goed', 'gone', 'goes'], 0),
      q('"Big" so‘zining antonimi qaysi?', ['small', 'large', 'huge', 'tall'], 0, 10),
      q('"Kutubxona" inglizcha qanday aytiladi?', ['library', 'bookstore', 'laboratory', 'liberty'], 0),
      tf('uz', '"Child" so‘zining ko‘plik shakli — "children".', true)
    ]
  },
  {
    title: 'English Grammar Challenge',
    description: 'Tenses, articles and conditionals for intermediate learners.',
    category: 'english',
    language: 'en',
    difficulty: 'medium',
    tags: ['grammar', 'intermediate'],
    questions: [
      q('She ___ to school every day.', ['goes', 'go', 'going', 'gone'], 0, 10),
      q('What is the past participle of "write"?', ['written', 'wrote', 'writed', 'writing'], 0),
      q('Choose the correct article: "I saw him ___ hour ago."', ['an', 'a', 'the', 'no article'], 0, 20, 'We use "an" because "hour" starts with a vowel sound.'),
      q('Which word is a synonym of "happy"?', ['joyful', 'angry', 'tired', 'bored'], 0, 10),
      q('If I ___ rich, I would travel the world.', ['were', 'am', 'will be', 'be'], 0, 20, 'Second conditional uses the past subjunctive "were".'),
      tf('en', '"Their", "there" and "they’re" have the same meaning.', false)
    ]
  },
  {
    title: 'Английский для начинающих',
    description: 'Простые слова и фразы на английском языке.',
    category: 'english',
    language: 'ru',
    difficulty: 'easy',
    tags: ['английский', 'слова'],
    questions: [
      q('Как по-английски «кошка»?', ['cat', 'dog', 'cow', 'mouse'], 0, 10),
      q('Как переводится «Thank you»?', ['Спасибо', 'Пожалуйста', 'Привет', 'Извините'], 0, 10),
      q('Какое слово означает «красный»?', ['red', 'green', 'blue', 'yellow'], 0, 10),
      q('Множественное число слова «man»?', ['men', 'mans', 'mens', 'manes'], 0),
      q('Как сказать «Доброе утро»?', ['Good morning', 'Good night', 'Good evening', 'Goodbye'], 0, 10),
      tf('ru', '«Sunday» — это суббота.', false, '«Sunday» — воскресенье, суббота — «Saturday».')
    ]
  },

  /* ---------------- Science ---------------- */
  {
    title: 'Fizika va kimyo',
    description: 'Formulalar, birliklar va tabiat qonunlari.',
    category: 'science',
    language: 'uz',
    difficulty: 'medium',
    tags: ['fizika', 'kimyo'],
    questions: [
      q('Suvning kimyoviy formulasi qaysi?', ['H₂O', 'CO₂', 'O₂', 'NaCl'], 0, 10),
      q('Yorug‘likning vakuumdagi tezligi taxminan qancha?', ['300 000 km/s', '30 000 km/s', '3 000 km/s', '1 000 000 km/s'], 0),
      q('Xalqaro birliklar tizimida (SI) kuch birligi qaysi?', ['Nyuton', 'Joul', 'Vatt', 'Paskal'], 0),
      q('Davriy jadvaldagi "Fe" belgisi qaysi elementga tegishli?', ['Temir', 'Fosfor', 'Ftor', 'Fransiy'], 0),
      q('Dengiz sathida toza suv necha °C da qaynaydi?', ['100', '90', '80', '120'], 0, 10),
      tf('uz', 'Tovush vakuumda tarqalmaydi.', true, 'Tovush tarqalishi uchun muhit (havo, suv, qattiq jism) kerak.')
    ]
  },
  {
    title: 'Biologiya: tirik tabiat',
    description: 'Hujayra, o‘simliklar va hayvonot olami.',
    category: 'science',
    language: 'uz',
    difficulty: 'easy',
    tags: ['biologiya'],
    questions: [
      q('Fotosintez jarayonida o‘simliklar qaysi gazni yutadi?', ['Karbonat angidrid (CO₂)', 'Kislorod', 'Azot', 'Vodorod'], 0),
      q('Odam yuragi necha kameradan iborat?', ['4', '2', '3', '5'], 0, 10),
      q('Hujayraning "energiya stansiyasi" deb qaysi organoid ataladi?', ['Mitoxondriya', 'Yadro', 'Ribosoma', 'Lizosoma'], 0),
      q('Yer yuzidagi eng katta sut emizuvchi qaysi?', ['Ko‘k kit', 'Afrika fili', 'Jirafa', 'Oq akula'], 0),
      q('Odam hujayrasida DNK asosan qayerda joylashgan?', ['Hujayra yadrosida', 'Hujayra devorida', 'Qon plazmasida', 'Teri ustida'], 0),
      tf('uz', 'Ko‘rshapalak — qush.', false, 'Ko‘rshapalak uchadigan sut emizuvchi hisoblanadi.')
    ]
  },
  {
    title: 'Space & Planets',
    description: 'A quick trip around our Solar System.',
    category: 'science',
    language: 'en',
    difficulty: 'easy',
    tags: ['space', 'astronomy'],
    questions: [
      q('Which planet is known as the Red Planet?', ['Mars', 'Venus', 'Jupiter', 'Mercury'], 0, 10),
      q('What is the largest planet in our Solar System?', ['Jupiter', 'Saturn', 'Neptune', 'Earth'], 0, 10),
      q('What is at the center of our Solar System?', ['The Sun', 'The Earth', 'The Moon', 'Jupiter'], 0, 10),
      q('How many planets are in our Solar System?', ['8', '9', '7', '10'], 0, 10, 'Since 2006 Pluto has been classified as a dwarf planet.'),
      q('Who was the first human to travel into space, in 1961?', ['Yuri Gagarin', 'Neil Armstrong', 'Buzz Aldrin', 'John Glenn'], 0),
      tf('en', 'The Moon produces its own light.', false, 'The Moon reflects sunlight.')
    ]
  },

  /* ---------------- History ---------------- */
  {
    title: 'O‘zbekiston tarixi',
    description: 'Buyuk ajdodlar, shaharlar va muhim sanalar.',
    category: 'history',
    language: 'uz',
    difficulty: 'medium',
    tags: ['tarix', 'ozbekiston'],
    featured: true,
    questions: [
      q('O‘zbekiston davlat mustaqilligi qachon e’lon qilingan?', ['1991-yil 31-avgust', '1990-yil 20-iyun', '1992-yil 8-dekabr', '1991-yil 25-dekabr'], 0, 20, 'Mustaqillik kuni har yili 1-sentabrda nishonlanadi.'),
      q('Amir Temur qaysi shahar yaqinida tug‘ilgan?', ['Shahrisabz (Kesh)', 'Samarqand', 'Buxoro', 'Xiva'], 0),
      q('"Boburnoma" asarining muallifi kim?', ['Zahiriddin Muhammad Bobur', 'Alisher Navoiy', 'Mirzo Ulug‘bek', 'Abu Rayhon Beruniy'], 0),
      q('Mirzo Ulug‘bek rasadxonasi qaysi shaharda joylashgan?', ['Samarqand', 'Toshkent', 'Buxoro', 'Termiz'], 0),
      q('O‘zbekiston Respublikasi Konstitutsiyasi dastlab qachon qabul qilingan?', ['1992-yil 8-dekabr', '1991-yil 1-sentabr', '1995-yil 30-avgust', '2000-yil 1-yanvar'], 0),
      q('"Algebra" so‘zi qaysi olim asarining nomidan kelib chiqqan?', ['Muhammad al-Xorazmiy', 'Abu Ali ibn Sino', 'Abu Rayhon Beruniy', 'Abu Nasr Forobiy'], 0)
    ]
  },
  {
    title: 'Jahon tarixi',
    description: 'Qadimgi tsivilizatsiyalardan XX asrgacha.',
    category: 'history',
    language: 'uz',
    difficulty: 'medium',
    tags: ['tarix', 'jahon'],
    questions: [
      q('Ikkinchi jahon urushi qaysi yili tugagan?', ['1945', '1939', '1941', '1950'], 0, 10),
      q('Giza piramidalari qaysi qadimgi tsivilizatsiyaga tegishli?', ['Qadimgi Misr', 'Qadimgi Rim', 'Qadimgi Yunoniston', 'Mayya'], 0),
      q('1492-yilda Amerika qit’asiga yetib borgan sayyoh kim?', ['Xristofor Kolumb', 'Vasko da Gama', 'Fernan Magellan', 'Marko Polo'], 0),
      q('Buyuk Ipak yo‘li asosan qaysi mintaqalarni bog‘lagan?', ['Xitoy va O‘rta yer dengizi', 'Afrika va Avstraliya', 'Amerika va Yevropa', 'Arktika va Antarktida'], 0),
      q('Birinchi jahon urushi qaysi yili boshlangan?', ['1914', '1918', '1905', '1939'], 0, 10),
      tf('uz', 'Berlin devori 1989-yilda qulagan.', true)
    ]
  },
  {
    title: 'История мира',
    description: 'Империи, открытия и ключевые даты.',
    category: 'history',
    language: 'ru',
    difficulty: 'hard',
    tags: ['история'],
    questions: [
      q('В каком году человек впервые высадился на Луну?', ['1969', '1961', '1975', '1957'], 0, 10),
      q('Кто был первым императором Рима?', ['Октавиан Август', 'Юлий Цезарь', 'Нерон', 'Константин Великий'], 0, 20, 'Юлий Цезарь был диктатором, но не императором.'),
      q('Столицей какой империи был Константинополь?', ['Византийской', 'Персидской', 'Монгольской', 'Карфагенской'], 0),
      q('Кто изобрёл книгопечатание с подвижными литерами в Европе?', ['Иоганн Гутенберг', 'Леонардо да Винчи', 'Галилео Галилей', 'Исаак Ньютон'], 0),
      q('В каком году распался СССР?', ['1991', '1989', '1993', '1985'], 0, 10),
      tf('ru', 'Великую Китайскую стену построили за один год.', false, 'Стену строили и перестраивали на протяжении многих веков.')
    ]
  },

  /* ---------------- Geography ---------------- */
  {
    title: 'O‘zbekiston geografiyasi',
    description: 'Viloyatlar, daryolar, tog‘lar va qo‘shni davlatlar.',
    category: 'geography',
    language: 'uz',
    difficulty: 'easy',
    tags: ['geografiya', 'ozbekiston'],
    questions: [
      q('O‘zbekistonning poytaxti qaysi shahar?', ['Toshkent', 'Samarqand', 'Buxoro', 'Andijon'], 0, 10),
      q('O‘zbekistonda nechta viloyat bor?', ['12', '10', '14', '9'], 0, 20, '12 viloyat, Qoraqalpog‘iston Respublikasi va Toshkent shahri.'),
      q('O‘zbekistonning eng baland nuqtasi qaysi?', ['Hazrati Sulton cho‘qqisi', 'Katta Chimyon', 'Zomin tog‘i', 'Elbrus'], 0),
      q('Qaysi ikki daryo Orol dengiziga quyilgan?', ['Amudaryo va Sirdaryo', 'Zarafshon va Chirchiq', 'Volga va Ural', 'Nil va Kongo'], 0),
      q('O‘zbekiston nechta davlat bilan chegaradosh?', ['5', '4', '6', '3'], 0, 20, 'Qozog‘iston, Qirg‘iziston, Tojikiston, Afg‘oniston va Turkmaniston.'),
      tf('uz', 'O‘zbekiston — ikki karra dengizga chiqish imkoni yo‘q davlat.', true, 'Dunyoda bunday davlat faqat ikkita: O‘zbekiston va Lixtenshteyn.')
    ]
  },
  {
    title: 'World Capitals',
    description: 'Do you know the capitals of these countries?',
    category: 'geography',
    language: 'en',
    difficulty: 'medium',
    tags: ['capitals', 'countries'],
    questions: [
      q('What is the capital of Japan?', ['Tokyo', 'Kyoto', 'Osaka', 'Seoul'], 0, 10),
      q('What is the capital of Australia?', ['Canberra', 'Sydney', 'Melbourne', 'Perth'], 0),
      q('What is the capital of Canada?', ['Ottawa', 'Toronto', 'Vancouver', 'Montreal'], 0),
      q('What is the capital of Turkey?', ['Ankara', 'Istanbul', 'Izmir', 'Antalya'], 0),
      q('What is the capital of Brazil?', ['Brasília', 'Rio de Janeiro', 'São Paulo', 'Salvador'], 0),
      q('What is the capital of Kazakhstan?', ['Astana', 'Almaty', 'Shymkent', 'Bishkek'], 0)
    ]
  },
  {
    title: 'География мира',
    description: 'Океаны, горы, страны и пустыни.',
    category: 'geography',
    language: 'ru',
    difficulty: 'medium',
    tags: ['география'],
    questions: [
      q('Какой океан самый большой?', ['Тихий', 'Атлантический', 'Индийский', 'Северный Ледовитый'], 0, 10),
      q('Какая гора самая высокая в мире?', ['Эверест', 'Эльбрус', 'Килиманджаро', 'Монблан'], 0, 10),
      q('Какая страна самая большая по площади?', ['Россия', 'Канада', 'Китай', 'США'], 0, 10),
      q('На каком материке находится Египет?', ['Африка', 'Азия', 'Европа', 'Южная Америка'], 0),
      q('Какая жаркая пустыня самая большая в мире?', ['Сахара', 'Гоби', 'Каракумы', 'Калахари'], 0),
      tf('ru', 'Каспийское море — крупнейшее по площади озеро на Земле.', true)
    ]
  },

  /* ---------------- General ---------------- */
  {
    title: 'Umumiy bilim',
    description: 'Hamma uchun qiziqarli savollar to‘plami.',
    category: 'general',
    language: 'uz',
    difficulty: 'easy',
    tags: ['umumiy', 'qiziqarli'],
    featured: true,
    questions: [
      q('Kamalakda nechta rang bor?', ['7', '5', '6', '8'], 0, 10),
      q('Bir sutka necha soatdan iborat?', ['24', '12', '36', '48'], 0, 10),
      q('Shaxmatda qaysi dona faqat diagonal bo‘ylab yuradi?', ['Fil', 'Ot', 'Ruh', 'Farzin'], 0),
      q('Futbol jamoasida maydonda bir vaqtda nechta o‘yinchi bo‘ladi?', ['11', '9', '10', '12'], 0, 10),
      q('Qaysi hayvon "cho‘l kemasi" deb ataladi?', ['Tuya', 'Ot', 'Fil', 'Eshak'], 0, 10),
      tf('uz', 'Quyosh — yulduz.', true)
    ]
  },
  {
    title: 'Mantiq va topqirlik',
    description: 'O‘ylab ko‘ring — javob har doim ham ko‘rinib turganidek emas!',
    category: 'general',
    language: 'uz',
    difficulty: 'medium',
    tags: ['mantiq', 'boshqotirma'],
    questions: [
      q('Ketma-ketlikni davom ettiring: 1, 1, 2, 3, 5, 8, …', ['13', '11', '12', '15'], 0, 20, 'Fibonachchi ketma-ketligi: har bir son oldingi ikkitasining yig‘indisi.'),
      q('Bugun dushanba bo‘lsa, 10 kundan keyin qaysi kun bo‘ladi?', ['Payshanba', 'Chorshanba', 'Juma', 'Seshanba'], 0),
      q('Soat 3:00 da soat va minut millari orasidagi burchak necha gradus?', ['90°', '60°', '120°', '45°'], 0),
      q('Qaysi so‘z ortiqcha: olma, nok, sabzi, o‘rik?', ['Sabzi', 'Olma', 'Nok', 'O‘rik'], 0, 10, 'Sabzi — sabzavot, qolganlari — mevalar.'),
      q('5 ta mushuk 5 ta sichqonni 5 daqiqada tutsa, 100 ta mushuk 100 ta sichqonni necha daqiqada tutadi?', ['5', '100', '20', '1'], 0, 30, 'Har bir mushuk bitta sichqonni 5 daqiqada tutadi.'),
      tf('uz', 'Kvadratning barcha tomonlari teng.', true)
    ]
  },
  {
    title: 'General Knowledge Mix',
    description: 'A little bit of everything — perfect for a warm-up round.',
    category: 'general',
    language: 'en',
    difficulty: 'medium',
    tags: ['trivia', 'mix'],
    questions: [
      q('How many continents are there?', ['7', '5', '6', '8'], 0, 10),
      q('Which gas do humans need to breathe to survive?', ['Oxygen', 'Nitrogen', 'Helium', 'Carbon dioxide'], 0, 10),
      q('What is the hardest natural substance?', ['Diamond', 'Gold', 'Iron', 'Quartz'], 0),
      q('How many sides does a hexagon have?', ['6', '5', '7', '8'], 0, 10),
      q('Which instrument usually has 88 keys?', ['Piano', 'Guitar', 'Violin', 'Flute'], 0),
      tf('en', 'Bats are blind.', false, 'Bats can see; many species also use echolocation.')
    ]
  }
];
