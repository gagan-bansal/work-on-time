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
  }, refreshInterval);
}

let tasksTable;

loadTable();

function loadTable () {
  tasksTable = $('#tblTasks').DataTable({
    // data: data,
    ajax: './api/tasks',
    columns: [
      {title: 'uuid', uuid: 'uuid', data: 'uuid',
        render: colorJobId
      },
      {title: 'Job', data: 'job', defaultContent: ''},
      {title: 'Job Id', data: 'data.id', defaultContent: ''},
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
        "defaultContent": '<input type="button" class="btn btn-result" value="Result">'
      },
      {
        title: 'Actions',
        "className":      'details-control',
        "orderable":      false,
        "data":           null,
        "defaultContent": '<input class="btn btn-stop" type="button" value="Stop">'
      }
    ],
    order: [[ 1, "desc" ]],
    columnDefs:[{
      targets: '_all',
      createdCell: formatStatus
    }]
  })

  $('#tblTasks tbody').on('click', '.btn-task-data', function () {
    var tr = $(this).closest('tr');
    var row = tasksTable.row( tr );
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
    var row = tasksTable.row( tr );
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

  $('#tblTasks tbody').on('click', '.btn-stop', function () {
    var tr = $(this).closest('tr');
    var row = tasksTable.row( tr );
    stopTask(row.data());
  });
}

// render function to format date
function formatDate (data, type, row) {
  if (data === '-') return data
  return data ? dayjs.tz(data, 'Asia/Kolkata').format('YYYY-MM-DD kk:mm:ss') : ''
}

function colorJobId (data, type, row) {
  let color
  if (row.status.completed) color = '#03a652'
  else if (row.status.failed || row.status.stopped) color = 'red'
  else if (row.status.started) color = '#444da3'
  else if (row.status.addedToQueue) color = '#fdaf16'
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
    // superSet.rawData = data
    //var filtered = showAll === 'true' ? data : data.filter(doc => doc.job !== 'upf')
    // loadTable(data)
    tasksTable.ajax.reload(null, false);
    console.log(data)
    //fetchJobs();
  })
  .fail(function (resp) {
    console.error('Error: ', resp.message);
  })
}
