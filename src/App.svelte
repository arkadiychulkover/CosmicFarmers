<script>

let resolveStorageReady;

const storageReady = new Promise(resolve => {
    resolveStorageReady = resolve;
});
const ggdcalcwithexpetion = (array,exeption) => array.reduce((a, b) => (b!=exeption)?(a+Math.max(b-10,0)):a);
const averagewithexpetion = (array,exeption) => array.reduce((a, b) => (b!=exeption)?a + b:a) / array.length;
const maxwithexpetion = (array,exeption) => array.reduce((a, b) => (b!=exeption)?(b>a?b:a):a);
const minwithexpetion = (array,exeption) => array.reduce((a, b) => (b!=exeption)?(b<a?b:a):a);
class SoilData {
    #longitude=$state()
    #latitude=$state()
    #t2m=$state()
    #t2m_max=$state()
    #t2m_min=$state()
    #rh2m=$state()
    #prectotcorr=$state()
    #allsky=$state()
    #ws2m=$state()
    #daily_t2m=$state()
    #gdd=$state()
    #isinit = $state(false)
    #ready

    constructor() {}
    get longitude() { return this.#longitude}
    get latitude() { return this.#latitude }
    get t2m() { return this.#t2m }
    get t2m_max() { return this.#t2m_max }
    get t2m_min() { return this.#t2m_min }
    get rh2m() { return this.#rh2m }
    get prectotcorr() { return this.#prectotcorr }
    get allsky() { return this.#allsky }
    get ws2m() { return this.#ws2m }
    get daily_t2m() { return this.#daily_t2m }
    get gdd() { return this.#gdd }
    get isinit() { return this.#isinit }
    async asget_longitude() { await this.#ready; return this.#longitude }
    async asget_latitude() { await this.#ready; return this.#latitude }
    async asget_t2m() { await this.#ready; return this.#t2m }
    async asget_t2m_max() { await this.#ready; return this.#t2m_max }
    async asget_t2m_min() { await this.#ready; return this.#t2m_min }
    async asget_rh2m() { await this.#ready; return this.#rh2m }
    async asget_prectotcorr() { await this.#ready; return this.#prectotcorr }
    async asget_allsky() { await this.#ready; return this.#allsky }
    async asget_ws2m() { await this.#ready; return this.#ws2m }
    async asget_daily_t2m() { await this.#ready; return this.#daily_t2m }
    async asget_gdd() { await this.#ready; return this.#gdd }
    async asget_isinit() { await this.#ready; return this.#isinit }

    async dataInit(promdata, longitude, latitude) {
        this.#longitude = longitude
        this.#latitude = latitude

        this.#ready = promdata.then(function(data) {
            let exeption = data.header.fill_value
            let t2marr = Object.values(data.properties.parameter.T2M)

            this.#t2m = averagewithexpetion(t2marr, exeption)
            this.#t2m_max = averagewithexpetion(Object.values(data.properties.parameter.T2M_MAX), exeption)
            this.#t2m_min = averagewithexpetion(Object.values(data.properties.parameter.T2M_MIN), exeption)
            this.#rh2m = averagewithexpetion(Object.values(data.properties.parameter.RH2M), exeption)
            this.#prectotcorr = averagewithexpetion(Object.values(data.properties.parameter.PRECTOTCORR), exeption)
            this.#allsky = averagewithexpetion(Object.values(data.properties.parameter.ALLSKY_SFC_SW_DWN), exeption)
            this.#ws2m = averagewithexpetion(Object.values(data.properties.parameter.WS2M), exeption)
            this.#daily_t2m = t2marr
            this.#gdd = ggdcalcwithexpetion(t2marr, exeption)
            this.#isinit = true
        }.bind(this))
    }

    retrive() {
        this.#ready = (async () => {
            if (!localStorage.getItem("isinit")) {
                await storageReady;
            }

            console.log("retriving")
            this.#t2m = localStorage.getItem("t2m")
            this.#t2m_max = localStorage.getItem("t2m_max")
            this.#t2m_min = localStorage.getItem("t2m_min")
            this.#rh2m = localStorage.getItem("rh2m")
            this.#prectotcorr = localStorage.getItem("prectotcorr")
            this.#allsky = localStorage.getItem("allsky")
            this.#ws2m = localStorage.getItem("ws2m")
            this.#daily_t2m = JSON.parse(localStorage.getItem("daily_t2m"))
            this.#gdd = localStorage.getItem("gdd")
            this.#longitude = localStorage.getItem("longitude")
            this.#latitude = localStorage.getItem("latitude")
            this.#isinit = true
        })()
    }

    async print() {
        await this.#ready
        console.log(`t2m: ${this.#t2m}`)
        console.log(`t2m_max: ${this.#t2m_max}`)
        console.log(`t2m_min: ${this.#t2m_min}`)
        console.log(`rh2m: ${this.#rh2m}`)
        console.log(`prectotcorr: ${this.#prectotcorr}`)
        console.log(`allsky: ${this.#allsky}`)
        console.log(`ws2m: ${this.#ws2m}`)
        console.log(`daily_t2m: ${this.#daily_t2m}`)
        console.log(`gdd: ${this.#gdd}`)
        console.log(`longitude: ${this.#longitude}`)
        console.log(`latitude: ${this.#latitude}`)
    }

    async store() {
        await this.#ready

        localStorage.setItem("t2m", this.#t2m)
        localStorage.setItem("t2m_max", this.#t2m_max)
        localStorage.setItem("t2m_min", this.#t2m_min)
        localStorage.setItem("rh2m", this.#rh2m)
        localStorage.setItem("prectotcorr", this.#prectotcorr)
        localStorage.setItem("allsky", this.#allsky)
        localStorage.setItem("ws2m", this.#ws2m)
        localStorage.setItem("daily_t2m", JSON.stringify(this.#daily_t2m))
        localStorage.setItem("gdd", this.#gdd)
        localStorage.setItem("longitude", this.#longitude)
        localStorage.setItem("latitude", this.#latitude)
        localStorage.setItem("isinit", this.#isinit)

        resolveStorageReady()
    }
}


const MONTHOFFSET=4;//should be less or equal to 12
async function getWeather(longitude,latitude) {
    const url = "https://power.larc.nasa.gov/api/temporal/daily/point";
const date = new Date();
const formattedDate = date.getFullYear() +
    String(date.getMonth() + 1).padStart(2, '0') +
    String(date.getDate()).padStart(2, '0');
    
    var formattedDateOffset;
    if(date.getMonth()+1<MONTHOFFSET){
        formattedDateOffset= date.getFullYear()-1 +
    String(date.getMonth() + 1+12-MONTHOFFSET).padStart(2, '0') +
    String(date.getDate()).padStart(2, '0');
    }else{
        formattedDateOffset = date.getFullYear() +
    String(date.getMonth() + 1-MONTHOFFSET).padStart(2, '0') +
    String(date.getDate()).padStart(2, '0');

    }
    console.log(formattedDate)
    console.log(formattedDateOffset)

    const params = new URLSearchParams({
        parameters: "T2M,T2M_MAX,T2M_MIN,RH2M,PRECTOTCORR,ALLSKY_SFC_SW_DWN,WS2M",
        community: "AG",
        longitude: longitude,
        latitude: latitude,
        start: formattedDateOffset,
        end: formattedDate,
        format: "JSON"
    });

    const response = await fetch(`${url}?${params}`);

    if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
    }
    const data = await response.json();
    
    console.log(data)
    return data
}

localStorage.clear();
let obj=new SoilData()
console.log(storageReady)
console.log(localStorage.getItem("isinit"))
    obj.dataInit(getWeather(50.0,30.0),50.0,30.0);
    console.log(storageReady)
    obj.store()
    let a=new SoilData()
    a.retrive()
    a.print()
    
    //console.log(`rh2m: ${a.longitude}`)
    
</script>
<p1>{a.longitude}</p1>