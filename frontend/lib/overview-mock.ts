// Genel bakıştaki bu pencere öğeleri için henüz API yok; hepsi örnek veridir ve yalnız bu modülden gelir.
// API bağlandığında bu dosya silinir ve bileşenler gerçek yanıtı kullanır.

export const mockCashFlow = {
  months: ["Ara", "Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas"],
  income: [118, 121, 120, 126, 131, 128, 135, 138, 140, 142, 146, 102].map((v) => v * 1000),
  expense: [24, 41, 22, 19, 33, 21, 26, 48, 23, 25, 29, 31.2].map((v) => v * 1000),
};

export type MockOverdue = { unit: string; name: string; since: string; amount: number; status: "late" | "partial" };
export const mockOverdue: MockOverdue[] = [
  { unit: "D-201", name: "Selin Kaya", since: "Vadesi 12 gün önce geçti", amount: 12000, status: "late" },
  { unit: "D-304", name: "Murat Aksoy", since: "Vadesi 5 gün önce geçti", amount: 6500, status: "partial" },
  { unit: "D-102", name: "Deniz Arslan", since: "Vadesi 2 gün önce geçti", amount: 2500, status: "late" },
];

export type MockUpcoming = { unit: string; name: string; due: string; amount: number; inDays: number };
export const mockUpcoming: MockUpcoming[] = [
  { unit: "D-101", name: "Ayşe Yılmaz", due: "1 Aralık", amount: 14000, inDays: 5 },
  { unit: "D-203", name: "Can Demir", due: "3 Aralık", amount: 11500, inDays: 7 },
  { unit: "D-302", name: "Elif Şahin", due: "5 Aralık", amount: 13000, inDays: 9 },
];

export const mockMonth = { title: "Kasım tahsilatı", paid: 102000, partial: 27000, late: 21000, total: 150000 };
