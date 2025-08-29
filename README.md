# thesis-price-comparison-hr-eu
Ovaj rad detaljno prikazuje razvoj i implementaciju cjelovitog sustava za dinamičko praćenje i
analizu cijena namirnica diljem više europskih zemalja. Arhitektura sustava temeljena je na
sofisticiranom pristupu koji obuhvaća web prikupljanje, naprednu normalizaciju podataka te
precizno semantičko uparivanje proizvoda.
Kroz automatizirane procese, sustav uspješno prikuplja ažurne podatke o cijenama iz digitalnih
kataloga Lidla za tržišta Hrvatske, Slovenije, Austrije i Njemačke. Ključna inovacija je
hijerarhijski algoritam za uparivanje proizvoda. On efikasno identificira i povezuje isti proizvod
preko granica, ne oslanjajući se isključivo na globalne identifikatore poput GTIN kodova. Ova
metoda, koja analizira i uparuje proizvode na temelju marke, veličine i kategorije, postigla je
iznimno visoku stopu uspješnosti od 85%.
Tehnička jezgra sustava čini robustan skup alata. Playwright se koristi za dinamično i učinkovito
web prikupljanje, PostgreSQL služi kao pouzdano rješenje za transakcijsko skladištenje
podataka, dok je za intuitivno i moderno korisničko sučelje odabran Vue 3. Konačni rezultat je
moćan alat koji omogućuje usporedbu cijena, analizu tržišnih trendova i transparentnost cijena za
potrošače, demonstrirajući kako se moderna softverska arhitektura može primijeniti za rješavanje
kompleksnih problema u realnom svijetu.
