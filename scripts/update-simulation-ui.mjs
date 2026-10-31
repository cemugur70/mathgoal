import {readFile,writeFile} from 'node:fs/promises';
const file=new URL('../dist/simulation-ui.mjs',import.meta.url);
let source=await readFile(file,'utf8');
const replacements=[
 ['Oyuncunun süre aldığı son ${input.formCount} maç kullanılır.', 'Kartlarda kişisel son ${input.formCount} maç ile takımın son ${input.formCount} maçındaki katılım ayrı gösterilir. Birim gücü ve geçmiş takım kıyası yalnızca hedef ligdeki maçlardan hesaplanır.'],
 ['Her takım 11 oyuncu ve bir kaleciyle başlar. En fazla 5 değişiklik, 3 değişiklik penceresi ve 90 dakika kullanılır.', 'Her takım bir kaleci, en az 3 defans, 2 orta saha ve 1 forvetle başlar. En fazla 5 değişiklik, 3 pencere, pencere başına 3 değişiklik ve 90 dakika kullanılır.'],
 ['Oyuncu etkisi, seçili kadro ile takımın geçmiş dakika dağılımı arasındaki farktır.', 'Oyuncu etkisi, seçili kadro ile takımın aynı ligdeki geçmiş dakika dağılımı arasındaki farktır. Oyuncu profili ve lig/mevki referansı aynı turnuva havuzundan gelir; kupa ve Avrupa maçları bu kıyasa karışmaz. Lig verisi yetersizse ilgili birim etkisi nötr kalır.'],
 ['Yedekler aynı mevkide, ikinci yarıdaki üç pencere civarında geçmiş katılım sürelerine göre seçilir.', 'Yedekler aynı mevkide, takımın son maçlarındaki katılım ve yedekten giriş sıklığına göre seçilir. Üç değişiklik penceresinin öncül ağırlıkları %25 / %45 / %30’dur; gözlenen çıkış dakikaları bu dağılımı günceller. Bir pencereye en fazla 3 değişiklik atanır.'],
 ['Gösterilen golcü bir senaryo seçimidir.', 'Golcü seçimi %70 xG/90 ve %30 gol/90 karışımına dayanır; küçük örneklem, dakika / (dakika + 270) ile mevki öncülüne küçültülür ve küçük bir olasılık tabanı kullanılır. Eksik ölçüm öncülde kalır. Gösterilen golcü bir senaryo seçimidir.'],
 ['<p>${input.limitations.map(esc).join(\'<br>\')}</p>', '<p>Genel bakış, benzer maç skorlarını Poisson dağılımıyla karıştırır ve etkin oyuncu/H2H katmanlarını içerir. Bu simülasyon takım ağının Poisson yoğunluklarıyla başlar; seçilen kadro ve değişiklikleri ayrıca uygular. Benzer maç karışımını ve H2H düzeltmesini eklemez. Bu yüzden iki ekrandaki gol, 1X2, üst ve KG olasılıkları farklı olabilir. Monte Carlo örneklemesi de küçük farklar üretir.</p><p>${input.limitations.map(esc).join(\'<br>\')}</p>'],
 ['Birim değerleri lig/mevki referansına göre küçültülmüş göreli farktır;', 'Oyuncu profilleri, lig/mevki referansı ve geçmiş takım dağılımı aynı lig kapsamındadır. Birim değerleri bu referansa göre küçültülmüş göreli farktır;']
];
for(const [before,after] of replacements){
 if(!source.includes(before))throw new Error(`UI metni bulunamadı: ${before}`);
 source=source.replace(before,after);
}
await writeFile(file,source);
