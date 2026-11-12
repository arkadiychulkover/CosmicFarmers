import { mount } from 'svelte';
import '@fontsource-variable/inter';
import './style.css';
import App from './App.svelte';

const app = mount(App, {
  target: document.getElementById('app'),
});

export default app;

const ggdcalcwithexpetion = (array,exeption) => array.reduce((a, b) => (b!=exeption)?(a+Math.max(b-10,0)):a);
const averagewithexpetion = (array,exeption) => array.reduce((a, b) => (b!=exeption)?a + b:a) / array.length;
const maxwithexpetion = (array,exeption) => array.reduce((a, b) => (b!=exeption)?(b>a?b:a):a);
const minwithexpetion = (array,exeption) => array.reduce((a, b) => (b!=exeption)?(b<a?b:a):a);
class SoilData{
    t2m
    t2m_max
    t2m_min
    rh2m
    prectotcorr 
    allsky
    ws2m
    daily_t2m
    gdd
    constructor(){

    }
    dataInit(data){
        let exeption=data.header.fill_value
        let t2marr=Object.values(data.properties.parameter.T2M)
        this.t2m=averagewithexpetion(t2marr,exeption)
        this.t2m_max=averagewithexpetion(Object.values(data.properties.parameter.T2M_MAX),exeption)
        this.t2m_min=averagewithexpetion(Object.values(data.properties.parameter.T2M_MIN),exeption)
        this.rh2m=averagewithexpetion(Object.values(data.properties.parameter.RH2M),exeption)
        this.prectotcorr=averagewithexpetion(Object.values(data.properties.parameter.PRECTOTCORR),exeption)
        this.allsky=averagewithexpetion(Object.values(data.properties.parameter.ALLSKY_SFC_SW_DWN),exeption)
        this.ws2m=averagewithexpetion(Object.values(data.properties.parameter.WS2M),exeption)
        this.daily_t2m=t2marr
        this.gdd=ggdcalcwithexpetion(t2marr,exeption)
    }
    retrive(){
        this.t2m = localStorage.getItem("t2m");
        this.t2m_max = localStorage.getItem("t2m_max");
        this.t2m_min = localStorage.getItem("t2m_min");
        this.rh2m = localStorage.getItem("rh2m");
        this.prectotcorr = localStorage.getItem("prectotcorr");
        this.allsky = localStorage.getItem("allsky");
        this.ws2m = localStorage.getItem("ws2m");
        this.daily_t2m = localStorage.getItem("daily_t2m");
        this.gdd=localStorage.getItem("gdd");
    }
    print(){
        console.log(`t2m: ${this.t2m}`)
        console.log(`t2m_max: ${this.t2m_max}`)
        console.log(`t2m_min: ${this.t2m_min}`)
        console.log(`rh2m: ${this.rh2m}`)
        console.log(`prectotcorr: ${this.prectotcorr}`)
        console.log(`allsky: ${this.allsky}`)
        console.log(`ws2m: ${this.ws2m}`)
        console.log(`daily_t2m: ${this.daily_t2m}`)
        console.log(`gdd: ${this.gdd}`)
    }
    store(){
        localStorage.setItem("t2m", this.t2m);
        localStorage.setItem("t2m_max", this.t2m_max);
        localStorage.setItem("t2m_min", this.t2m_min);
        localStorage.setItem("rh2m", this.rh2m);
        localStorage.setItem("prectotcorr", this.prectotcorr);
        localStorage.setItem("allsky", this.allsky);
        localStorage.setItem("ws2m", this.ws2m);
        localStorage.setItem("daily_t2m", this.daily_t2m);
        localStorage.setItem("gdd", this.gdd);
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
    let obj=new SoilData()
    obj.dataInit(data);
    console.log(data)
    //obj.print()
    return obj;
}
function testfun(a){
    a.store()
    let obj=new SoilData()
    obj.retrive()
    obj.print()
}
getWeather(50.0,30.0).then(a=>testfun(a));
