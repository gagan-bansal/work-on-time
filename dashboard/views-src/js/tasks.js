import $ from 'jquery';
import dt from 'datatables.net-dt';
import * as dayjs from 'dayjs';
import advancedFormat from 'dayjs/plugin/advancedFormat';
dayjs.extend(advancedFormat);
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone'); // dependent on utc plugin
dayjs.extend(utc)
dayjs.extend(timezone)
dt();

import * as addTaskModal from './add-task-modal.js';

import 'datatables.net-dt/css/jquery.dataTables.css';
import '../css/styles.css';
const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
const refreshInterval = urlParams.get('refreshInterval') || 30000
if (urlParams.get('refresh')) {
  window.setTimeout(function () {
    window.location.reload();
  }, parseInt(refreshInterval) * 1000);
}

import './add-task-modal.js';
let taskTable;

loadTable();

function loadTable () {
  taskTable = $('#tblTasks').DataTable({
    // data: data,
    ajax: {
      url: './api/tasks',
      dataSrc: function (data) {
        return data.filter(d => !d.status.delete);
      } 
    },
    columns: [
      {title: 'uuid', uuid: 'uuid', data: 'uuid',
        render: colorTaskId
      },
      {title: 'Worker', data: 'worker', defaultContent: ''},
      {title: 'Task Id', data: 'data.id', defaultContent: ''},
      {
        title: "Task Data",
        "className": 'details-control',
        "orderable": false,
        "data": null,
        "defaultContent": '<input type="button" class="btn btn-task-data" value="Task Data">'
      },
      {title: 'Created', defaultContent: '',
        data: function (rec) {
          return rec.status.created || rec.created
        },
        render: formatDate
      },
      {title: 'Added To Queue', data: 'status.addedToQueue', defaultContent: '', render: formatDate, visible: false},
      {title: 'Started', data: 'status.started', defaultContent: '', render: formatDate},
      {title: 'Stopped', data: 'status.stopped', defaultContent: '-', render: formatDate},
      {title: 'Failed', data: 'status.failed', defaultContent: '-', render: formatDate},
      {title: 'Message',
        data: function (rec) {
          return rec.message || (rec.error && rec.error.message) || rec.error || '-'
        },
        defaultContent: '-'
      },
      {title: 'Completed', data: 'status.completed', defaultContent: '-', render: formatDate},
      {
        title: "Task Result",
        "className": 'details-control',
        "orderable": false,
        "data": null,
        //"defaultContent": '<input type="button" class="btn btn-result" value="Result">'
        render: function (data, type, row) {
          const isDone = data.status.completed || data.status.failed || data.status.stopped;
          return isDone ? '<input type="button" class="btn btn-result" value="Result">' : '-';
        }
      },
      {
        title: 'Actions',
        "className":      'details-control',
        "orderable":      false,
        "data":           null,
        // "defaultContent": '<input class="btn btn-stop" type="button" value="Stop">'
        render: function (data, type, row) {
          const isRunning = data.status.started &&
            !data.status.completed  && !data.status.failed && !data.status.stopped
            && !data.status.deleted;
          let renderStr = '';
          if (isRunning) renderStr = '<input class="btn btn-stop" type="button" value="Stop">';
          //if (!data.status.deleted) renderStr += '<input class="btn btn-delete" type="button" value="Delete">'
          return renderStr ? renderStr : '-';
        }
      }
    ],
    order: [[ 4, "desc" ]],
    columnDefs:[{
      targets: '_all',
      createdCell: formatStatus
    }],
    initComplete: function (settings, json) {
      // init modal addTask
      addTaskModal(taskTable);
    }
  })

  $('#tblTasks tbody').on('click', '.btn-task-data', function () {
    var tr = $(this).closest('tr');
    var row = taskTable.row( tr );
    var btn = this;
      // var btn = $(this).find('input')
      if ( row.child.isShown() ) {
        // This row is already open - close it
        row.child.hide();
        tr.removeClass('shown');
        $(btn).val('Task Data')
      }
      else {
        // Open this row
        //row.child( format(row.data()) ).show();
        const data = row.data();
        row.child('<pre> ' + JSON.stringify(data.data || 'No data', null, 4) + '</pre>').show();
        tr.addClass('shown');
        $(btn).val('Less')
      }
  });

  $('#tblTasks tbody').on('click', '.btn-result', function () {
    var tr = $(this).closest('tr');
    var row = taskTable.row( tr );
    var btn = this;
      // var btn = $(this).find('input')
      if ( row.child.isShown() ) {
        // This row is already open - close it
        row.child.hide();
        tr.removeClass('shown');
        $(btn).val('Result')
      }
      else {
        // Open this row
        //row.child( format(row.data()) ).show();
        const data = row.data();
        row.child('<pre> ' + JSON.stringify(data.result || 'No result', null, 4) + '</pre>').show();
        tr.addClass('shown');
        $(btn).val('Less')
      }
  });

  $('#tblTasks tbody').on('click', '.btn-stop', function () {
    var tr = $(this).closest('tr');
    var row = taskTable.row( tr );
    stopTask(row.data());
  });

  $('#tblTasks tbody').on('click', '.btn-delete', function () {
    var tr = $(this).closest('tr');
    var row = taskTable.row( tr );
    deleteTask(row.data());
  });
}

// render function to format date
function formatDate (data, type, row) {
  if (data === '-') return data
  return data ? dayjs.tz(data, 'Asia/Kolkata').format('YYYY-MM-DD kk:mm:ss') : ''
}

function colorTaskId (data, type, row) {
  let color
  if (row.status.completed) color = '#03a652'
  else if (row.status.failed || row.status.stopped || row.status.deleted) color = 'red'
  else if (row.status.started) color = '#444da3'
  else if (row.status.addedToQueue) color = '#fdaf16'
  if (color) {
    return `<span style="color:${color};font-weight:bold;${row.status.deleted ? 'text-decoration: line-through' : ''}">${data}</span>`
  } else {
    return data
  }
}

// createCell functions
function formatStatus (td, data, rowData, row, col) {
  if (data === 'done') $(td).css('color', 'green')
  if (data === 'error') $(td).css('color', 'red')
  if (data === 'running') $(td).css('color', 'orange')
}

// stop the running task
function stopTask(rowData) {
  $.ajax({
    method: 'PUT',
    url: `./api/task/stop/${rowData.uuid}`,
    cache: false
  })
  .done(function(data) {
    taskTable.ajax.reload(null, false);
  })
  .fail(function (resp) {
    console.error('Error: ', resp.message);
  })
}

// delete the task
function deleteTask(rowData) {
  $.ajax({
    method: 'DELETE',
    url: `./api/task/${rowData.uuid}`,
    cache: false
  })
  .done(function(data) {
    taskTable.ajax.reload(null, false);
  })
  .fail(function (resp) {
    console.error('Error: ', resp.message);
  })
}
