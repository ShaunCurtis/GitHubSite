---
title: Chapter 7 - Adding Sorting and Paging to the List Form
oneliner: Adding Sorting and Paging to the List Form
precis: Adding Sorting and Paging to the List Form
date: 2021-08-13
published: 2021-08-13
---

# Chapter 7 - Adding Sorting and Paging to the List Form

This chapter explains how to add sorting and paging to the WeatherForecast List Form.

## Refactoring the Form

As we start to add more functionality to the List Form we need to extract the common code into a boilerplate form component.

### ListFormBase

Add a *BaseForms* folder to *BlazorDB.UI/Forms*.

Add a `ListFormBase` class.  This is the initial code:

```csharp
using BlazorDB.Core;
using Microsoft.AspNetCore.Components;
using System.Threading.Tasks;

namespace BlazorDB.UI.Forms
{
    public abstract class ListFormBase<TRecord> : ComponentBase
        where TRecord : class, IRecord, new()
    {
        protected IViewService<TRecord> ViewService { get; set; }

        protected override async Task OnInitializedAsync()
        {
            this.LoadViewService();
            await this.LoadRecords();
        }

        protected abstract void LoadViewService();

        protected virtual async ValueTask LoadRecords()
        {
            await this.ViewService.GetRecordsAsync();
        }
    }
}
```

1. The class is `abstract`, you can't use it directly.
2. `TRecord` has the regular constraints.
3. `LoadViewService` is abstract and must be implemented by a child component.
4. `LoadRecordsAsync` is virtual, so can be overidden.  It calls `IViewService.GetRecordsAsync()` to populate the ViewService.

### WeatherForecastListForm

Modify `WeatherForecastListForm` to inherit from `ListFormBase` and implement `LoadViewService`:

```csharp
@namespace BlazorDB.UI.Forms
@inherits ListFormBase<WeatherForecast>

.....

@code {
    [Inject] protected WeatherForecastViewService weatherForecastViewService { get; set; }

    protected override void LoadViewService()
        =>  this.ViewService = weatherForecastViewService;
}
```

## RecordPager

Our first step is to build a `RecordPager` this is the class that interacts with UI and tracks the current page.

The class is shown below. 

```csharp
using System;

namespace BlazorDB.Core.Data
{
    public class RecordPager
    {
        public int Page { get; private set; } = 1;

        public int RecordCount { get; set; } = 0;

        public int PageSize { get; set; } = 25;

        public int BlockSize { get; set; } = 5;

        public int Block => (int)Math.Ceiling((Decimal)(this.Page / this.BlockSize));

        public int LastPage => (int)Math.Ceiling((Decimal)(RecordCount / PageSize));

        public int LastBlock => (int)Math.Ceiling((Decimal)(this.LastPage / this.BlockSize));

        public int StartBlockPage => ((Block - 1) * BlockSize) + 1;

        public int EndBlockPage => StartBlockPage + BlockSize;

        public string SortColumn
        {
            get => (!string.IsNullOrWhiteSpace(_sortColumn)) ? _sortColumn : DefaultSortColumn;
            set => _sortColumn = value;
        }

        private string _sortColumn = string.Empty;

        public string DefaultSortColumn { get; set; } = "ID";

        public bool SortDescending { get; set; }

        public bool HasBlocks => this.LastPage > BlockSize;

        public bool HasPagination => this.RecordCount > PageSize;

        public RecordPagingData PagingData => new RecordPagingData()
        {
            Page = this.Page,
            PageSize = this.PageSize,
            BlockSize = this.BlockSize,
            RecordCount = this.RecordCount,
            SortColumn = this.SortColumn,
            SortDescending = this.SortDescending
        };

        public void ToPage(int pageNo)
        {
            if (pageNo++ < this.LastPage)
                this.Page++;
        }

        public void PageMove(int pages)
        {
            if (this.Page + pages < this.LastPage && this.Page + pages > 0)
                this.Page = this.Page + pages;
        }

        public void BlockMove(int blocks)
        {
            if (this.Block + blocks < this.LastBlock && this.Block + blocks > 0)
            {
                var newBlock = this.Block + blocks;
                this.Page = ((newBlock - 1) * BlockSize) + 1;
            }
        }

    }
}
```

A second simpler class `RecordPagingData` is used to pass data back to the Data Domain to fetch only the page data from the dataset.

```csharp
namespace BlazorDB.Core.Data
{
    public class RecordPagingData
    {
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 25;
        public int BlockSize { get; set; } = 10;
        public int RecordCount { get; set; } = 0;
        public string SortColumn { get; set; } = string.Empty;
        public bool SortDescending { get; set; } = false;
    }
}
```
Both classes reside in the core domain, and are in *BlazorDB.Core/Data*.






