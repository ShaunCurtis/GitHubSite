---
title: Part 2 - A Blazor Database Primer - Rebuilding the UI
oneliner: This article walks the user through re-organising the Blazor Template Appplication UI.
precis: This article walks the user through re-organising the Blazor Template Appplication UI.
date: 2021-08-13
published: 2021-08-13
---

# A Blazor Database Primer - Rebuilding the UI

Our primary focus in this article is on the FetchData page:

```csharp
@page "/fetchdata"

@using WeatherTesting.Data
@inject WeatherForecastService ForecastService

<h1>Weather forecast</h1>

<p>This component demonstrates fetching data from a service.</p>

@if (forecasts == null)
{
    <p><em>Loading...</em></p>
}
else
{
    <table class="table">
        <thead>
            <tr>
                <th>Date</th>
                <th>Temp. (C)</th>
                <th>Temp. (F)</th>
                <th>Summary</th>
            </tr>
        </thead>
        <tbody>
            @foreach (var forecast in forecasts)
            {
                <tr>
                    <td>@forecast.Date.ToShortDateString()</td>
                    <td>@forecast.TemperatureC</td>
                    <td>@forecast.TemperatureF</td>
                    <td>@forecast.Summary</td>
                </tr>
            }
        </tbody>
    </table>
}

@code {
    private WeatherForecast[] forecasts;

    protected override async Task OnInitializedAsync()
    {
        forecasts = await ForecastService.GetForecastAsync(DateTime.Now);
    }
}
```

Why change it?

1. There's no separation of corncerns.  The component both gets, manages and holds the data and displays it.
2. We're mixing high level functionality - this is a form - with the nitty gritty of building raw Html.
3. How do we embed this list into another page?

The goal is a page that looks like this:

```html
@page "/WeatherForecasts"

<WeatherForecastListForm/>
```
And `WeatherForecastListForm` looks like this:

```csharp
@namespace BlazorDB.UI.Forms

<UIListControl TRecord="WeatherForecast" Records="this.ViewService.Records" IsLoaded="this.ViewService.HasRecords" class="table">
    <RowTemplate>
        <UIListColumn HeaderTitle="Date">@context.Date.ToShortDateString()</UIListColumn>
        <UIListColumn HeaderTitle="Temp &deg; C">@context.TemperatureC</UIListColumn>
        <UIListColumn HeaderTitle="Temp &deg; F">@context.TemperatureF</UIListColumn>
        <UIListColumn HeaderTitle="Summary">@context.Summary</UIListColumn>
        <UIListColumn HeaderTitle="Detail">@context.Name</UIListColumn>
    </RowTemplate>
</UIListControl>

@code {
    [Inject] BlazorDB.Core.WeatherForecastViewService ViewService { get; set; }

    protected override async Task OnInitializedAsync()
    {
        await ViewService.GetRecordsAsync();
    }
}
```

## Nomenclature

The word "Page" creates serious confusion word in Blazor and all SPA frameworks.  It's used to describe different things in different contexts.  Look at the code above - `@page "/fetchdata"
`.  Is `FetchData` really a web page?  In my book, no.  There's only one (Web) Page in a SPA - the startup page.  From then on the SPA changes out and manipulates the DOM in that page.  The browser doesn't reload anything.

Throughout this set of articles the following nomenclature is used:
1. **Page** is a web page that the browser loads.
2. **RouteView** is the component that gets loaded when the "route" changes.  `RouteView` is the name of the component that's responsible in `App` for changing out the component associated with a specific route.
3. **Form** is a high level component that does a "unit of work" - display a list of records, edit a record, enter out user information.  Forms are built from controls, not markup.
4. **Control** is a low level component that builds out the html markup.  Controls can contains controls.

![Methodologies](/siteimages/articles/DB-Primer/methodology.png)

## Base Controls and Utilities

To help build out UI components we need a base class:

```csharp
using Microsoft.AspNetCore.Components;
using System.Collections.Generic;
using System.Linq;

namespace Blazr.UIComponents
{
    public abstract class UIComponentBase : ComponentBase
    {
        [Parameter] public bool Show { get; set; } = true;
        [Parameter] public RenderFragment ChildContent { get; set; }
        [Parameter(CaptureUnmatchedValues = true)] public IDictionary<string, object> UserAttributes { get; set; } = new Dictionary<string, object>();
        protected virtual List<string> UnwantedAttributes { get; set; } = new List<string>();

        protected Dictionary<string, object> SplatterAttributes
        {
            get
            {
                var list = new Dictionary<string, object>();
                foreach (var item in UserAttributes)
                {
                    if (!UnwantedAttributes.Any(item1 => item1.Equals(item.Key)))
                        list.Add(item.Key, item.Value);
                }
                return list;
            }
        }
    }
}
```

1. `Show` can be used to show or hide the components in markup.
2. `ChildContent` is the content betwween the opening and closing tags for the component. In `<MyComponent><span>Hello</span></MyComponent>`, `<span>Hello</span>` is the ChildContent.
3. `UserAttributes` are all the attributes added to the component that are not `Parameters`. In `<MyComponent class="my-class"><span>Hello</span></MyComponent>`, `class="my-class"` is an unmatched attribute.
4. `UnwantedAttributes` lets you define a list of attributes you want to remove from the attribute list.  If you define your own `class` and want to discard any `class` component specified `class`, add `class` to the `UnwantedAttributes` list.
5. `SplatterAttributes` are the `UserAttributes` minus the `UnwantedAttributes`.  We'll see it in use later.

### CSSBuilder

One of the most common tasks in a UI component is building the Css class.

`CSSBuilder` uses the builder pattern to collect and then output a class string.

```csharp
// File: BlazorDB.UI/Utils
using System.Collections.Generic;
using System.Text;
using System.Linq;

namespace BlazorDB.UI
{
    public class CSSBuilder
    {
        private Queue<string> _cssQueue = new Queue<string>();

        public static CSSBuilder Class(string cssFragment = null)
        {
            var builder = new CSSBuilder(cssFragment);
            return builder.AddClass(cssFragment);
        }

        public CSSBuilder(string cssFragment)
            => AddClass(cssFragment);

        public CSSBuilder AddClass(string cssFragment)
        {
            if (!string.IsNullOrWhiteSpace(cssFragment)) _cssQueue.Enqueue(cssFragment);
            return this;
        }

        public CSSBuilder AddClass(IEnumerable<string> cssFragments)
        {
            if (cssFragments != null)
                cssFragments.ToList().ForEach(item => _cssQueue.Enqueue(item));
            return this;
        }

        public CSSBuilder AddClass(string cssFragment, bool WhenTrue)
            => WhenTrue ? this.AddClass(cssFragment) : this;

        public CSSBuilder AddClass(string trueCssFragment, string falseCssFragment, bool WhenTrue)
            => WhenTrue ? this.AddClass(trueCssFragment) : this.AddClass(falseCssFragment);

        public CSSBuilder AddClassFromAttributes(IReadOnlyDictionary<string, object> additionalAttributes)
        {
            if (additionalAttributes != null && additionalAttributes.TryGetValue("class", out var val))
                _cssQueue.Enqueue(val.ToString());
            return this;
        }

        public CSSBuilder AddClassFromAttributes(IDictionary<string, object> additionalAttributes)
        {
            if (additionalAttributes != null && additionalAttributes.TryGetValue("class", out var val))
                _cssQueue.Enqueue(val.ToString());
            return this;
        }

        public string Build(string CssFragment = null)
        {
            if (!string.IsNullOrWhiteSpace(CssFragment)) _cssQueue.Enqueue(CssFragment);
            if (_cssQueue.Count == 0)
                return string.Empty;
            var sb = new StringBuilder();
            foreach (var str in _cssQueue)
            {
                if (!string.IsNullOrWhiteSpace(str)) sb.Append($" {str}");
            }
            return sb.ToString().Trim();
        }
    }
}
```

### UIListColumn

`UIListColumn` builds out the header and data rows.
1. If `IsHeader` is cascaded it builds the header row.
2. If `IsMaxColumn` is set it builds out a column with overflow control.
3. With no overrides, it builds out a standard `td` Column.

```csharp
// File: BlazorDB.U/Components/ListControls/UIListColumn.razor.cs
using Microsoft.AspNetCore.Components;

namespace BlazorDB.UI.Components
{
    public partial class UIListColumn : UIComponentBase
    {
        [CascadingParameter(Name = "IsHeader")] public bool IsHeader { get; set; }
        [Parameter] public bool IsMaxColumn { get; set; }
        [Parameter] public string HeaderTitle { get; set; }
        [Parameter] public bool IsHeaderNoWrap { get; set; }

        private bool isMaxRowColumn => IsMaxColumn && !this.IsHeader;
        private bool isNormalRowColumn => !IsMaxColumn && !this.IsHeader;
        protected override List<string> UnwantedAttributes { get; set; } = new List<string>() { "class" };

        private string HeaderCSS
            => CSSBuilder.Class()
                .AddClass("header-column-nowrap", "header-column", IsHeaderNoWrap)
                .AddClass("align-baseline")
                .Build();
    }
}
```

```html
// File: BlazorDB.U/Components/ListControls/UIistColumn.razor
@namespace BlazorDB.UI.Components
@inherits BlazorDB.UI.Components.UIComponentBase

@if (this.IsHeader)
{
    <th class="@this.HeaderCSS">
        @((MarkupString)this.HeaderTitle)
    </th>
}
else if (this.isMaxRowColumn)
{
    <td class="max-column" @attributes="this.SplatterAttributes">
        <div class="grid-overflow">
            <div class="grid-overflowinner">
                @ChildContent
            </div>
        </div>
    </td>
}
else
{
    <td class="data-column" @attributes="this.SplatterAttributes">
        @this.ChildContent
    </td>
}
```

```css
// File: BlazorDB.U/Components/ListControls/UIistColumn.razor.css
.data-column {
    max-width: 30%;
}

.max-column {
    width:50%;
}

.grid-overflow {
    display: flex;
}

.grid-overflowinner {
    flex: 1;
    width: 1px;
    overflow-x: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
}

.header-column-nowrap {
    white-space: nowrap;
}
```

### UIListControl

`UIListControl` builds out the table framework.

1. The `RowTemplate` has a context `TRecord`.
2. The builder uses the `RowTemplate` to build out the header by cascading `IsHeader` to the template.  It passes the `RowTemplate` a default instance of `TRecord`.
3. Data is only displayed when `IsLoaded` is true.

```csharp
// File: BlazorDB.U/Components/ListControls/UIListControl.razor.cs
using Microsoft.AspNetCore.Components;
using System.Collections.Generic;

namespace BlazorDB.UI.Components
{
    public partial class UIListControl<TRecord> : UIComponentBase
    {
        [Parameter] public bool IsLoaded { get; set; }
        [Parameter] public RenderFragment<TRecord> RowTemplate { get; set; }
        [Parameter] public IEnumerable<TRecord> Records { get; set; }
    }
}
```

```html
// File: BlazorDB.U/Components/ListControls/UIListControl.razor
namespace BlazorDB.UI.Components
@inherits BlazorDB.UI.Components.UIComponentBase
@typeparam TRecord

@if (this.IsLoaded)
{
    <table @attributes="this.SplatterAttributes">
        <thead>
            <CascadingValue Name="IsHeader" Value="true">
                <tr>
                    @RowTemplate(default(TRecord))
                </tr>
            </CascadingValue>
        </thead>
        <tbody>
            @foreach (var item in this.Records)
            {
                <tr>
                    @RowTemplate(item)
                </tr>
            }
        </tbody>
    </table>
}
else
{
    <div class="m-2 p-2">Loading...</div>
}
```

### WeatherForecastListForm

`WeatherForecastListForm` is the form for displaying `WeatherForecasts`.

The form:
1. Injects the `WeatherForecastViewService` and call `GetRecordsAsync` to get the records.
2. Uses the `UIListControl` and `UIListColumn` components to define the list.

```html
\\ File: BlazorDB.UI/Forms/WeatherForecast/WeatherForecastListForm.razor
@namespace BlazorDB.UI.Forms

<UIListControl TRecord="WeatherForecast" Records="this.ViewService.Records" IsLoaded="this.ViewService.HasRecords" class="table">
    <RowTemplate>
        <UIListColumn HeaderTitle="Date">@context.Date.ToShortDateString()</UIListColumn>
        <UIListColumn HeaderTitle="Temp &deg; C">@context.TemperatureC</UIListColumn>
        <UIListColumn HeaderTitle="Temp &deg; F">@context.TemperatureF</UIListColumn>
        <UIListColumn HeaderTitle="Summary">@context.Summary</UIListColumn>
        <UIListColumn HeaderTitle="Detail" IsMaxColumn="true">@context.Name</UIListColumn>
    </RowTemplate>
</UIListControl>
```
```html
@code {
    [Inject] WeatherForecastViewService ViewService { get; set; }

    protected override async Task OnInitializedAsync()
    {
        await ViewService.GetRecordsAsync();
    }
}
```

### WeatherForcasts

`WeatherForcasts` is the RouteView.

```html
// File: BlazorDB.UI.RouteViews/WeatherForecasts.razor
@page "/WeatherForecasts"
<WeatherForecastListForm/>
```
