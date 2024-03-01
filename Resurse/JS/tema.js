window.onload=function(){ //se executa dupa ce se descarca toate resursele (.css, img, biblioteci etc)

    let tema=localStorage.getItem("tema");
    if(tema){
        document.body.classList.add("dark");
    }


    document.getElementById("tema").onclick=function(){
        if(document.body.classList.contains("dark")){
            document.body.classList.remove("dark");
            localStorage.removeItem("tema");
            document.getElementById("tema").textContent="☼"
        }
        else{
            document.body.classList.add("dark");
            localStorage.setItem("tema","dark");
            document.getElementById("tema").textContent="☽"
        }
    }
}