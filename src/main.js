/*import { mount } from 'svelte';
import App from './App.svelte';
import './style.css';
const app = mount(App, {
    target: document.getElementById('app')
});
export default app;*/


const averagewithexpetion = (array,exeption) => array.reduce((a, b) => (b!=exeption)?a + b:a) / array.length;
const maxwithexpetion = (array,exeption) => array.reduce((a, b) => (b!=exeption)?(b>a?b:a):a);
const minwithexpetion = (array,exeption) => array.reduce((a, b) => (b!=exeption)?(b<a?b:a):a);
class SoilData{
    t2m
    t2m_max
    t2m_min
    rh2m
    prectotcorr 
    //allsky
    //ws2m
    daily_t2m
    //gdd = float(np.sum(np.maximum(daily_t2m - 10.0, 0.0)))

    constructor(data){
        let t2marr=Object.values(data.properties.parameter.T2M)
        let rh2marr=Object.values(data.properties.parameter.RH2M)
        let prectotcorr=Object.values(data.properties.parameter.PRECTOTCORR)
        let exeption=data.header.fill_value
        this.t2m=averagewithexpetion(t2marr,exeption)
        this.t2m_max=maxwithexpetion(t2marr,exeption)
        this.t2m_min=minwithexpetion(t2marr,exeption)
        this.prectotcorr=averagewithexpetion(prectotcorr,exeption)
        this.rh2m=averagewithexpetion(rh2marr,exeption)
        this.daily_t2m=t2marr
    }
    print(){
        console.log(`t2m: ${this.t2m}`)
        console.log(`t2m_max: ${this.t2m_max}`)
        console.log(`t2m_min: ${this.t2m_min}`)
        console.log(`rh2m: ${this.rh2m}`)
        console.log(`prectotcorr: ${this.prectotcorr}`)
        console.log(`daily_t2m:${this.daily_t2m}`)
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
        parameters: "T2M,PRECTOTCORR,RH2M",
        community: "RE",
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
/*t2m = np.mean(list(props["T2M"].values()))
t2m_max = np.mean(list(props["T2M_MAX"].values()))
t2m_min = np.mean(list(props["T2M_MIN"].values()))
rh2m = np.mean(list(props["RH2M"].values()))
# Осадки (PRECTOTCORR) обычно суммируются за сезон
prectotcorr = np.sum(list(props["PRECTOTCORR"].values())) / 4.0  # Среднемесячные !!!
allsky = np.mean(list(props["ALLSKY_SFC_SW_DWN"].values()))
ws2m = np.mean(list(props["WS2M"].values()))

# Накопленное тепло GDD (база 10°C) за сезон
daily_t2m = np.array(list(props["T2M"].values()))
gdd = float(np.sum(np.maximum(daily_t2m - 10.0, 0.0)))*/
    const data = await response.json();
    /*console.log(data["T2M"])
    const soilData=new SoilData(
        
        math.mean(list(data["T2M"].values()))

    )*/
   let obj=new SoilData(data)
   console.log(data)
    console.log(averagewithexpetion(Object.values(data.properties.parameter.T2M),data.header.fill_value))
    console.log(averagewithexpetion(Object.values(data.properties.parameter.RH2M),data.header.fill_value))
    console.log(averagewithexpetion(Object.values(data.properties.parameter.PRECTOTCORR),data.header.fill_value))
    obj.print()
    return obj;
}

let a=getWeather(50.0,30.0);
//a.print()