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
import 'datatables.net-dt/css/jquery.dataTables.css';

const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
const refreshInterval = urlParams.get('refreshInterval') || 30000
if (urlParams.get('refresh')) {
  window.setTimeout(function () {
    window.location.reload();
  }, parseInt(refreshInterval) * 1000);
}

let cronTasksTable;

loadTable();

function loadTable () {
  cronTasksTable = $('#tblCronTasks').DataTable({
    // data: data,
    ajax: './api/scheduled-tasks',
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
      {title: 'Schedule', data: 'when', defaultContent: '', render: formatWhen},
      {title: 'Stopped/Activated',
        data: function (rec) {
          return Math.max(rec.status.restarted || 0, rec.status.stopped || 0) || '-'
        },
        defaultContent: '-', render: formatDate},
      {title: 'Message',
        data: function (rec) {
          return rec.message || (rec.error && rec.error.message) || rec.error || '-'
        },
        defaultContent: '-'
      },
      {
        title: 'Actions',
        "className":      'details-control',
        "orderable":      false,
        "data":           null,
        render: function (data, type, row) {
          return data.isActive ? '<input class="btn btn-stop" type="button" value="Stop">'
            : '<input class="btn btn-activate" type="button" value="Activate">';
        }
      }
    ],
    order: [[ 4, "desc" ]],
    columnDefs:[{
      targets: '_all',
      createdCell: formatStatus
    }]
  })

  $('#tblCronTasks tbody').on('click', '.btn-task-data', function () {
    console.log('show task data');
    var tr = $(this).closest('tr');
    var row = cronTasksTable.row( tr );
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
        const task = row.data();
        row.child('<pre> ' + JSON.stringify(task.data || 'No data', null, 4) + '</pre>').show();
        tr.addClass('shown');
        $(btn).val('Less')
      }
  });

  $('#tblCronTasks tbody').on('click', '.btn-result', function () {
    var tr = $(this).closest('tr');
    var row = cronTasksTable.row( tr );
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
        row.child('<pre> ' + JSON.stringify(data || 'No result', null, 4) + '</pre>').show();
        tr.addClass('shown');
        $(btn).val('Less')
      }
  });

  $('#tblCronTasks tbody').on('click', '.btn-stop', function () {
    var tr = $(this).closest('tr');
    var row = cronTasksTable.row( tr );
    stopTask(row.data());
  });

  $('#tblCronTasks tbody').on('click', '.btn-activate', function () {
    var tr = $(this).closest('tr');
    var row = cronTasksTable.row( tr );
    restartTask(row.data());
  });
}

// render function to format date
function formatDate (data, type, row) {
  if (data === '-') return data
  return data ? dayjs.tz(data, 'Asia/Kolkata').format('YYYY-MM-DD kk:mm:ss') : ''
}

function formatWhen (data, type, row) {
  if (typeof data === 'string') return data;
  else return formatDate (data);
}

function colorTaskId (data, type, row) {
  let color
  if (row.status.stopped) color = 'orange'
  else color = '#03a652'
  if (color) return `<span style="color:${color};font-weight:bold;">${data}</span>`
  else return data
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
    cronTasksTable.ajax.reload(null, false);
  })
  .fail(function (resp) {
    console.error('Error: ', resp.message);
  })
}

// stop the running task
function restartTask(rowData) {
  $.ajax({
    method: 'PUT',
    url: `./api/task/restart/${rowData.uuid}`,
    cache: false
  })
  .done(function(data) {
    cronTasksTable.ajax.reload(null, false);
  })
  .fail(function (resp) {
    console.error('Error: ', resp.message);
  })
}
