'use strict';
var _ = require('lodash');
var axios = require('axios');
const icon = require("./assets/icon.png");
const log = require("loglevel");
log.setLevel("silent");
// log.setLevel("debug");

var cached_weburl = [];

var instance = null;


const per_page = 100;
var fetch_project_state = "STOP";

function QueryProjects(index,history,callback){
    fetch_project_state = "Fetching";
    instance.get('/projects', {
        params: {
            page: index + 1,
            per_page: per_page,
        }
    }).then((response)=>{
        var data = response.data;
        var web_urls = _.map(data,(key)=>{
            return [_.toLower(key.web_url),key.web_url];
        });
        history = _.concat(history,web_urls);
        cached_weburl = history;
        if(web_urls.length >= per_page){
            setTimeout(()=>{
                QueryProjects(index+1,history,callback);
            }, 1000);
        }
        else{
            fetch_project_state = "Finish";
            callback(history);
        }
    }).catch(function (error) {
        fetch_project_state = "Fail";
    });
}

var global_scope = null;
var lastshow_timestamp = null;
var last_display_ids = [];
var querying_term = null;

function FilterTerm(list,filters,display,actions,display_id){
  let re = new RegExp(".*"+_.concat(filters.join(".*"))+".*");
  var update_display_timestamp = new Date();
  var temp_id = "";
  list = _.filter(list,(value)=>{
    return value[0].match(re);
  });
  _.map(_.slice(list,0,10) ,(value)=>{
    temp_id = update_display_timestamp + value[1];
    last_display_ids[last_display_ids.length] = temp_id;
    display({
      id:temp_id,
      icon,
      title:`${value[1]}`,
      onSelect:()=>{ return actions.open(value[1]);}
    });
  });
}

const initialize = () => {
    QueryProjects(0,[],(result)=>{
        cached_weburl = result;
        log.debug("Fetch Data end global scope is:",global_scope);
        if(global_scope){
            if(last_display_ids){
                _.map(last_display_ids,(value)=>{
                    global_scope.hide(value);
                });
                last_display_ids = [];
            }
            if(querying_term.length > 0){
                var { term, display,actions,hide } = global_scope;
                FilterTerm(cached_weburl,_.slice(querying_term,1),display,actions,lastshow_timestamp);
            }
        }
        return result;
    });
}


const fn = (scope) => {
  var { term, display,actions,hide,settings } = scope;
    global_scope = scope;
    if (term.match('^gitlab ') || term.match('^gi ')) {
        var splited_term = term.split(' ');
      if(splited_term.length > 1){
        instance = axios.create({
          baseURL: settings.gitlabapi,
          timeout: 15000,
          responseType: 'json',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'PRIVATE-TOKEN': settings.gitlabapitoken
          }
        });

        log.debug("trigger gitlab fetch project state is: ",fetch_project_state," caced_weburl_lenght:",cached_weburl.length);
        querying_term = splited_term;
        lastshow_timestamp = new Date();

        last_display_ids[last_display_ids.length] = lastshow_timestamp;
        if(fetch_project_state === "Fail" || (cached_weburl.length === 0 && fetch_project_state === "STOP")){
          display({
            id:lastshow_timestamp,
            icon,
            title:`拉取数据中...`,
          });
          initialize();
        }
        else if (fetch_project_state === "Fetching") {
          display({
            id:lastshow_timestamp,
            icon,
            title:`拉取数据中...`,
          });
        }
        FilterTerm(cached_weburl,_.slice(splited_term,1),display,actions,lastshow_timestamp);
      }
    }
};

module.exports = {
  // initialize: initialize,
  fn: _.throttle(fn,600,{trailing:true}) ,
  settings: {
    gitlabapi: { type: 'string',defaultValue:"https://www.lejuhub.com/api/v4/" },
    gitlabapitoken: { type: 'string' },
  }
}


