const serverAddress = "http://"+document.location.host;
const isSaves = document.location.pathname == "/s";

let res = [];
$.get("/recent", (data) => {
  let res = JSON.parse(data);
  if (isSaves) {
    res = JSON.parse(localStorage.saves).slice(0,20);
  }

  for (var i = 0; i < res.length; i++) {
    if (res[i] == null) continue;
    let imgUrl = res[i];
    let imgExif = serverAddress + "/exif?file=" + res[i];
    let img;
    let wrapper = $("<div style='max-height:400px;overflow:hidden;clear:left;float:left'/>");
    if (res[i].match(/.*\.(mp4|mov)/i)) {
      img = $("<video muted controls autoplay loop height='400px' style=''>").attr("src", serverAddress + "/images/" + imgUrl);
    } else {
      img = $("<img style='max-height:400px;'>").attr("src", serverAddress + "/images/" + imgUrl);
    }
    let dateSlide = $("<div " +
            " style='height:400px;font-size:15px;font-weight:bold;padding-left:20px;color:white;mix-blend-mode:difference;float:left'></div>");
    let saveSlide = $("<button>Save For Later</button>");
    let rotateSlide = $("<button>Rotate</button>");

    $(document.body).append(wrapper);
    $(wrapper).append(img);
    $(document.body).append(dateSlide);
    if (!isSaves) {
      $(dateSlide).append(saveSlide);
    }

    $(dateSlide).append(rotateSlide);

    saveSlide.on("click", () =>{
      if (!localStorage.saves) {
        localStorage.saves = "[]";
      }
      let savesArr = JSON.parse(localStorage.saves);
      savesArr.unshift(imgUrl);
      savesArr.length = 1000;
      localStorage.saves = JSON.stringify(savesArr);
      $(saveSlide).remove();
    });

    rotateSlide.on("click", () => {
      rotateSlide.text("working....");
      let amount = img.rotated;
      if (!amount) { amount = 0; }
      amount += 90;
      if (amount >= 360) amount = 0;
      img.rotated = amount;
      img.attr("src", serverAddress + "/rot/?file=" + imgUrl + "&deg=" + amount);
      img.on("load", () => { rotateSlide.text("Rotate"); });
    });

    setTimeout(() =>{
      $.get(imgExif, (o) => {
        o = JSON.parse(o);
        var dateStr = "";
        if (o.date) {
          dateStr = o.date[0].split(/:/);
          dateSlide.append(`<div>${dateStr[1]}/${dateStr[2]}/${dateStr[0]}</div>`);
        }
        console.log(img.attr("style"));
          var rotation = 0;
          switch(o.orientation) {
            case "Rotate 270 CW":
              rotation = 270;
              break;
            case 3:
              rotation = 180;
              break;
            case "Rotate 90 CW":
              rotation = 90;
              break;
          }

          console.log("Transforming: " + rotation);
          img.css({ WebkitTransform: 'rotate(' + rotation + 'deg)'});
      });
    });
  }
});
