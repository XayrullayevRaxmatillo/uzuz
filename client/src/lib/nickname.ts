const WORDS = ['Lochin', 'Burgut', 'Yulduz', 'Chaqmoq', 'Bars', 'Shunqor', 'Kamalak', 'Quyosh', 'Tulpor', 'Olov', 'Shamol', 'Sher', 'Oqqush', 'Zukko', 'Daho', 'Alpomish'];

export function randomNickname(): string {
  const w = WORDS[Math.floor(Math.random() * WORDS.length)];
  return `${w}_${Math.floor(100 + Math.random() * 900)}`;
}
