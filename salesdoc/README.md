# SalesDoc → Excel oylik hisobot

`salesdoc_export.py` SalesDoc API V2 dan ([hujjat](https://github.com/Clever91/salesdoc-api-doc)) buyurtmalar, qaytarishlar, agentlar, do'konlar va mahsulotlarni tortib, bitta Excel fayl tayyorlaydi.

Skript faqat **o'qiydi** (`login` va `get*` metodlari). SalesDoc'da hech narsani o'zgartirmaydi.

## Sozlash (bir marta)

1. SalesDoc'da API uchun **alohida foydalanuvchi** oching.
   Muhim: SalesDoc'da har yangi login oldingi tokenni o'chiradi. Agar 1C yoki boshqa tizim ishlatayotgan loginni bersangiz, o'sha integratsiya uzilib qolishi mumkin.
2. Cloud environment sozlamalariga (sessiya sarlavhasidagi environment menyusi → Edit → Network secrets) qo'shing:
   - `SALESDOC_DOMAIN`: masalan, `kompaniya.salesdoc.io`
   - `SALESDOC_LOGIN`
   - `SALESDOC_PASSWORD`
   - `SALESDOC_FILIAL`: ixtiyoriy, faqat filiallar bo'lsa
3. Yangi sessiya oching.

## Ishga tushirish

```bash
python3 salesdoc/salesdoc_export.py                          # shu oy: 1-sanadan bugungacha
python3 salesdoc/salesdoc_export.py --product "happy toy"    # faqat nomida "happy toy" bor mahsulotlar
python3 salesdoc/salesdoc_export.py --from 2026-09-01 --to 2026-09-30   # o'tgan oy
```

## Excel varaqlari

| Varaq | Ichida nima bor |
|---|---|
| Xulosa | Jami sotuv (so'm, dona, blok), jarayondagi buyurtmalar, AKB, bekor qilinganlar, qaytarishlar |
| Agentlar | Har bir agent: buyurtmalar, AKB, sotuv, qaytarish, sof sotuv |
| Do'konlar | Har bir do'kon: qaysi agent, nechta buyurtma, qancha oldi |
| Mahsulotlar | Har bir mahsulot: nechta do'kon oldi, dona, blok, so'm |
| Buyurtma qatorlari | Xom ma'lumot: har bir buyurtmadagi har bir mahsulot |
| Qaytarishlar | Qaytarish hujjatlari va ularning sababi |

## Hisoblash qoidalari

- **Sotilgan**: holati 3 (Yetkazilgan) yoki 4 (Yopilgan) bo'lgan buyurtmalar.
- **Jarayonda**: holati 1 (Yangi) yoki 2 (Yuborilgan). Hali sotuv emas.
- **Bekor qilingan** (holat 5) hech qaysi summaga qo'shilmaydi.
- **AKB**: kamida bitta yetkazilgan buyurtmasi bor do'konlar soni.
- Sana buyurtma sanasi bo'yicha olinadi (`filter.period.date`).

⚠️ Birinchi haqiqiy ishga tushirishdan keyin jami summani SalesDoc'ning o'z hisoboti bilan solishtiring. Ayniqsa buyurtma ichidagi qaytarishlar (`returned`) va alohida qaytarish hujjatlari ikki marta sanalmayotganini tekshiring.
