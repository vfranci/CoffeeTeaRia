const express = require("express"); //ma ajuta sa creez obiect tip server
const fs= require('fs'); //file system
const path=require('path');
const sass=require('sass');
const sharp=require('sharp'); //pachet care editeaza imagini
const {Client}=require('pg'); //imi da doar proprietatea client din pg
const ejs=require('ejs'); 

var client= new Client({database:"coffeetearia_1",
        user:"franci",
        password:"castraveteroz",
        host:"localhost",
        port:5432});
client.connect();

client.query("select * from produse", function(err, res){
    console.log("Eroare BD: ", err);
    console.log("Rezultat BD: ", res);
})

obGlobal={
    obErori:null,
    obImagini:null,
    folderScss: path.join(__dirname, "Resurse/SCSS"),
    folderCss: path.join(__dirname, "Resurse/CSS"),
    folderBackup: path.join(__dirname, "backup"),
    optiuniMeniu:[]//vector pentru a genera meniul pe baza datelor din tabel
}

client.query("select * from unnest(enum_range(null::tipuri_produse))", function(err, rezTipuri){
    if (err){
        console.log(err);
    }
    else{
        obGlobal.optiuniMeniu=rezTipuri.rows; //pun tipurile de produse in vectorul optiuniMeniu
    }
});

//callback se executa mai tarziu, deci nu as putea folosi optiuniMeniu imediat dupa "scrierea functiei"
//tre sa astept raspuns e la baza de date etc

app= express();
console.log("Folder proiect", __dirname);
console.log("Cale fisier", __filename);
console.log("Director de lucru", process.cwd());

app.set("view engine","ejs");//foloseste ejs ca view engine;  view engine permite generarea dinamică a paginilor web prin combinarea datelor cu șabloane predefinite.

vectorFoldere=["temp", "temp1", "backup"]
for (let folder of vectorFoldere){
    let caleFolder=path.join(__dirname, folder)
    if (! fs.existsSync(caleFolder)){
        fs.mkdirSync(caleFolder);
    }

}

function compileazaScss(caleScss, caleCss){
    console.log("cale:",caleCss);
    if(!caleCss){
        //let vectorCale=caleScss.split("\\"); //pe windows, caile se pun cu \\; am pus doua \\, deoarece \ e caracter special la string
        //let numeFisExt=vectorCale[vectorCale.length-1];
        let numeFisExt=path.basename(caleScss);
        let numeFis=numeFisExt.split(".")[0]   /// "a.scss"  -> ["a","scss"]
        caleCss=numeFis+".css";
    }
    
    if (!path.isAbsolute(caleScss))
        caleScss=path.join(obGlobal.folderScss,caleScss )
    if (!path.isAbsolute(caleCss))
        caleCss=path.join(obGlobal.folderCss,caleCss )
    
    
    // la acest punct avem cai absolute in caleScss si caleCss
    //let vectorCale=caleCss.split("\\"); 
    //let numeFisCss=vectorCale[vectorCale.length-1]
    let numeFisCss=path.basename(caleCss);
    let caleResBackup=path.join(obGlobal.folderBackup, "Resurse/CSS"); //fac calea pentru backup/resurse/css
    if (!fs.existsSync(caleResBackup))
        fs.mkdirSync(caleResBackup, {recursive:true}); //creaza directoarele/subfolderele recursiv
    if (fs.existsSync(caleCss)){
        fs.copyFileSync(caleCss, path.join(obGlobal.folderBackup,"Resurse/CSS",numeFisCss ))// +(new Date()).getTime()
    }
    rez=sass.compile(caleScss, {"sourceMap":true}); //rezulta string cu cod css; sourceMap ajuta browserul sa vada linia din fisierul sass, 
    //chiar daca el nu primeste fisierul; ajuta la debugging
    fs.writeFileSync(caleCss,rez.css);
    console.log("Compilare SCSS",rez);
}
//exemplu: compileazaScss("a.scss"); ii dau cale relativa si intra pe primul if

vFisiere=fs.readdirSync(obGlobal.folderScss);
for(let numeFis of vFisiere){
    if(path.extname(numeFis)==".scss"){
        compileazaScss(numeFis);
    }
}

fs.watch(obGlobal.folderScss, function(eveniment, numeFis){ //verifica daca au survenit schimbari
    console.log(eveniment, numeFis);
    if(eveniment=="change" || eveniment=="rename"){ //rename e modificarea numelui, stergere, creare etc; change are schimbarea in el
        let caleCompleta=path.join(obGlobal.folderScss, numeFis);
        if(fs.existsSync(caleCompleta)){
            compileazaScss(caleCompleta);
        }
    }
}) 



app.use("/Resurse", express.static(__dirname+"/Resurse")); //fol exp.static ca sa dau calea de unde sa-mi ia fisierele statice
app.use("/node_modules", express.static(__dirname+"/node_modules"));

//vreau sa adaug optiuniMeniu in toate paginile
app.use("/*",function(req, res, next){
    res.locals.optiuniMeniu=obGlobal.optiuniMeniu; //adaug optiuniMeniu in locals
    next(); //vreau sa nu se opreasca la prima care se potriveste, asa ca folosesc next ca sa trec prin toate
})

app.use(/^\/Resurse(\/[a-zA-Z0-9]*)*$/, function(req,res){
    afisareEroare(res,403);
});


app.get("/favicon.ico", function(req,res){
    res.sendFile(__dirname+"/Resurse/favicon.ico");  //trimit o resursa de tip fisier
})

app.get("/ceva", function(req, res){
    console.log("cale:",req.url)
    res.send("<h1>altceva</h1> ip:"+req.ip);
})


app.get(["/index","/","/home" ], function(req, res){ //folosesc un vector ca sa am mai multe aliasuri cu []
    res.render("Pagini/index", {ip: req.ip, imagini:obGlobal.obImagini.imagini}); //render executa js din ejs
})

app.get("/despre",function(req,res){
    res.render("Pagini/despre");
});

app.get(["/index", "/", "/galerie"],function(req,res){
    res.render("Pagini/galerie", {imagini:obGlobal.obImagini.imagini});
});



app.get("/extraterestri",function(req, res){
    //console.log(req.query)
    //vreau sa obt valorile din enum
    //in enumul din pg, el le vede drept numere 
    //in enum_range, am un string in care sunt toate valorile, asa ca folosesc unnest ca sa sparg sirul 
    //intr-un vector cu mai multe elemente
    client.query("select * from extraterestri", function(err, rez){ 

                if(err){
                    console.log(err);
                    afisareEroare(res, 2);
                }
                else{
                    console.log(rez);
                    // Exemplu de șir de caractere cu valori separate de virgulă

                    //var valoareString = ;

                    // Folosește funcția split() pentru a crea un vector de valori separate
                    //var valoareArray = valoareString.split(";");

                    // Transmite vectorul către șablonul EJS
                    //res.render("Pagini/extraterestri", { valori: valoareArray });

                    //for(let plan of )
                    res.render("Pagini/extraterestri", {produse: rez.rows});

                }
            });
            
      

});

app.get("/extraterestru/:nume",function(req, res){ //: imi spune ca e query parametrizat, le pot folosi drept param
    console.log(req.params);
   
    client.query(`select * from produse where nume=${req.params.nume}`, function( err, rezultat){
        if(err){
            console.log(err);
            afisareEroare(res, 2);
        }
        else
            res.render("Pagini/extraterestru", {prod:rezultat.rows[0]});
    });
});

//---------------------------------------------------------------------------------------------------------------------

app.get("/produse",function(req, res){
    //console.log(req.query)
    //vreau sa obt valorile din enum
    //in enumul din pg, el le vede drept numere 
    //in enum_range, am un string in care sunt toate valorile, asa ca folosesc unnest ca sa sparg sirul 
    //intr-un vector cu mai multe elemente
    client.query("select * from unnest(enum_range(null::categ))", function(err, rezCategorie){ 
        if (err){
            console.log(err);
        }
        else{   
    //se adauaga filtrarea dupa tipul produsului
            let conditieWhere="";
            if(req.query.tip)
                conditieWhere=` where tip_produs='${req.query.tip}'`;  //fol apostrof oblic ca sa inserez valori folosind $; echiv "where tip='"+req.query.tip+"'"
            client.query("select * from produse " + conditieWhere , function( err, rez){
                console.log(300)
                if(err){
                    console.log(err);
                    afisareEroare(res, 2);
                }
                else{
                    console.log(rez);
                    res.render("Pagini/produse", {produse: rez.rows, optiuni: rezCategorie.rows});

                }
            });
            }
    });

        

});

//--------------------------------------------------------------------------------------------------------------------


app.get("/produs/:id",function(req, res){ //: imi spune ca e query parametrizat, le pot folosi drept param
    console.log(req.params);
   
    client.query(`select * from produse where id=${req.params.id}`, function( err, rezultat){
        if(err){
            console.log(err);
            afisareEroare(res, 2);
        }
        else
            res.render("Pagini/produs", {prod:rezultat.rows[0]});
    });
});

app.get("/*.ejs",function(req, res){
    afisareEroare(res,400);
})

app.get("/*",function(req, res){
    try{
        res.render("Pagini"+req.url, function(err, rezRandare){
            if(err){
                console.log(err);
                if(err.message.startsWith("Failed to lookup view"))
                //afisareEroare(res,{_identificator:404, _titlu:"ceva"});
                    afisareEroare(res,404);
                else
                    afisareEroare(res);
            }
            else{
                console.log(rezRandare);
                res.send(rezRandare);
            }
        } );
    } catch(err){
        if(err.message.startsWith("Cannot find module"))
        //afisareEroare(res,{_identificator:404, _titlu:"ceva"});
            afisareEroare(res,404, "Fisier resursa negasit!");
    }
})



function initErori(){
    var continut= fs.readFileSync(__dirname+"/Resurse/JSON/erori.json").toString("utf-8");
    //console.log(continut); il vede ca sir de octeti fara toString
    obGlobal.obErori=JSON.parse(continut); //json e obiect predefinit; preia proprietatile din continut
    let vErori=obGlobal.obErori.info_erori;
    
    //for (let i=0; i< vErori.length; i++ )
    for (let eroare of vErori){
        eroare.imagine="/"+obGlobal.obErori.cale_baza+"/"+eroare.imagine;
    }
}
initErori();


function initImagini(){
    var continut= fs.readFileSync(__dirname+"/Resurse/JSON/galerie.json").toString("utf-8");
    obGlobal.obImagini=JSON.parse(continut);
    let vImagini=obGlobal.obImagini.imagini;
    let caleAbs=path.join(__dirname, obGlobal.obImagini.cale_galerie);
    let caleMediu=path.join(caleAbs, "mediu");//folder in care vom crea imag de dim medie
    if (! fs.existsSync(caleMediu)){
        fs.mkdirSync(caleMediu);
    }
    let caleMic=path.join(caleAbs, "mic");//folder in care vom crea imag de dim medie
    if (! fs.existsSync(caleMic)){
        fs.mkdirSync(caleMic);
    }

    for (let imag of vImagini){
        [numeFis, extensie]=imag.fisier.split("."); //pune ce e inainte de punct in prima var si ce e dupa in a doua
        let caleAbsFisier=path.join(caleAbs, imag.fisier);
        let caleAbsFisierMediu=path.join(caleMediu, numeFis)+".webp";
        sharp(caleAbsFisier).resize(400).toFile(caleAbsFisierMediu);
        let caleAbsFisierMic=path.join(caleMic, numeFis)+".webp";
        sharp(caleAbsFisier).resize(200).toFile(caleAbsFisierMic);
        imag.fisier_mediu="/"+path.join(obGlobal.obImagini.cale_galerie,"mediu", numeFis+".webp");
        imag.fisier="/"+obGlobal.obImagini.cale_galerie+"/"+imag.fisier;
    }
}
initImagini();



/*
daca  programatorul seteaza titlul, se ia titlul din argument
daca nu e setat, se ia cel din json
daca nu avem titluk nici in json, se ia titlul din valoarea default
idem pentru celelalte
*/

//function afisareEroare(res, {_identificator, _titlu, _text, _imagine}={} ){
function afisareEroare(res, _identificator, _titlu="titlu default", _text, _imagine ){ //res transmitem ca param cand se apeleaza functia
    let vErori=obGlobal.obErori.info_erori;
    let eroare=vErori.find(function(elem) {return elem.identificator==_identificator;} )
    if(eroare){
        let titlu1= _titlu=="titlu default" ? (eroare.titlu || _titlu) : _titlu; 
        let text1= _text || eroare.text; //verific daca param e setat sau daca iau din json
        let imagine1= _imagine || eroare.imagine;
        if(eroare.status) //verificam daca statusul e true; status false e o eroare custom 
            res.status(eroare.identificator).render("Pagini/eroare", {titlu:titlu1, text:text1, imagine:imagine1});
        else
            res.render("Pagini/eroare", {titlu:titlu1, text:text1, imagine:imagine1}); //
    }
    else{ //daca nu gaseste eroare, afiseaza eroarea default
        let errDef=obGlobal.obErori.eroare_default;
        res.render("Pagini/eroare", {titlu:errDef.titlu, text:errDef.text, imagine:obGlobal.obErori.cale_baza+"/"+errDef.imagine});
    }
    

}


app.listen(8080); //portul pe care asculta cereri
console.log("Serverul a pornit");