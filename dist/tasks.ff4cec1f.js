function t(t){return t&&t.__esModule?t.default:t}var e="undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:"undefined"!=typeof window?window:"undefined"!=typeof global?global:{},a={},s={},n=e.parcelRequire440f;null==n&&((n=function(t){if(t in a)return a[t].exports;if(t in s){var e=s[t];delete s[t];var n={id:t,exports:{}};return a[t]=n,e.call(n.exports,n,n.exports),n.exports}var o=new Error("Cannot find module '"+t+"'");throw o.code="MODULE_NOT_FOUND",o}).register=function(t,e){s[t]=e},e.parcelRequire440f=n);var o=n("6KOho"),r=n("kYsr5"),l=n("gngdn"),d=n("f6zku");l.extend(t(d));var u=n("gogTx"),i=n("dLCGn");l.extend(u),l.extend(i),t(r)();const c=window.location.search,f=new URLSearchParams(c),p=f.get("refreshInterval")||3e4;let h;function b(t,e,a){return"-"===t?t:t?l.tz(t,"Asia/Kolkata").format("YYYY-MM-DD kk:mm:ss"):""}function w(t,e,a){let s;return a.status.completed?s="#03a652":a.status.failed||a.status.stopped?s="red":a.status.started?s="#444da3":a.status.addedToQueue&&(s="#fdaf16"),s?`<span style="color:${s};font-weight:bold;">${t}</span>`:t}function k(e,a,s,n,r){"done"===a&&t(o)(e).css("color","green"),"error"===a&&t(o)(e).css("color","red"),"running"===a&&t(o)(e).css("color","orange")}f.get("refresh")&&window.setTimeout((function(){window.location.reload()}),1e3*parseInt(p)),h=t(o)("#tblTasks").DataTable({ajax:"./api/tasks",columns:[{title:"uuid",uuid:"uuid",data:"uuid",render:w},{title:"Worker",data:"worker",defaultContent:""},{title:"Task Id",data:"data.id",defaultContent:""},{title:"Task Data",className:"details-control",orderable:!1,data:null,defaultContent:'<input type="button" class="btn btn-task-data" value="Task Data">'},{title:"Created",defaultContent:"",data:function(t){return t.status.created||t.created},render:b},{title:"Added To Queue",data:"status.addedToQueue",defaultContent:"",render:b,visible:!1},{title:"Started",data:"status.started",defaultContent:"",render:b},{title:"Stopped",data:"status.stopped",defaultContent:"-",render:b},{title:"Failed",data:"status.failed",defaultContent:"-",render:b},{title:"Message",data:function(t){return t.message||t.error&&t.error.message||t.error||"-"},defaultContent:"-"},{title:"Completed",data:"status.completed",defaultContent:"-",render:b},{title:"Task Result",className:"details-control",orderable:!1,data:null,render:function(t,e,a){return t.status.completed||t.status.failed||t.status.stopped?'<input type="button" class="btn btn-result" value="Result">':"-"}},{title:"Actions",className:"details-control",orderable:!1,data:null,render:function(t,e,a){return!t.status.started||t.status.completed||t.status.failed||t.status.stopped?"-":'<input class="btn btn-stop" type="button" value="Stop">'}}],order:[[4,"desc"]],columnDefs:[{targets:"_all",createdCell:k}]}),t(o)("#tblTasks tbody").on("click",".btn-task-data",(function(){var e=t(o)(this).closest("tr"),a=h.row(e);if(a.child.isShown())a.child.hide(),e.removeClass("shown"),t(o)(this).val("Task Data");else{const s=a.data();a.child("<pre> "+JSON.stringify(s.data||"No data",null,4)+"</pre>").show(),e.addClass("shown"),t(o)(this).val("Less")}})),t(o)("#tblTasks tbody").on("click",".btn-result",(function(){var e=t(o)(this).closest("tr"),a=h.row(e);if(a.child.isShown())a.child.hide(),e.removeClass("shown"),t(o)(this).val("Result");else{const s=a.data();a.child("<pre> "+JSON.stringify(s.result||"No result",null,4)+"</pre>").show(),e.addClass("shown"),t(o)(this).val("Less")}})),t(o)("#tblTasks tbody").on("click",".btn-stop",(function(){var e,a=t(o)(this).closest("tr"),s=h.row(a);e=s.data(),t(o).ajax({method:"PUT",url:`./api/task/stop/${e.uuid}`,cache:!1}).done((function(t){h.ajax.reload(null,!1)})).fail((function(t){console.error("Error: ",t.message)}))}));
//# sourceMappingURL=tasks.ff4cec1f.js.map
