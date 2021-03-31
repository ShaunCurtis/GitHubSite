---
title: Blazor Notification Service Pattern
precis: The Blazor Notifcation Service Pattern
date: 2021-03-31
---

# Blazor Notification Service Pattern

A common issue in Blazor is keeping components updated.  A value changes in one place, how do you make sure everyone else who needs to know are informed.  This is common in the Data Layer to UI interface.  A row in a list is updated in a modal or inline dialog and the list needs to be updated.  It's possible with callbacks and cascading parameters, but adds a lot og unnecessary complexity.

The solution is to use the Notification Service Pattern.  There are various version of it, but they're just different ways of coding the functionality.  Lets look at the problem in a very simplistic way.

1. A `RandomNumberService` service that generates and exposes a random number.  It can be either Singleton or Scoped.
2. A `ValueDisplay` component that displays the number with a button to update it.
3. A RouteView/Page with serveral versions of `ValueDisplay` wired up differently.

First we have a Scoped or Singleton Service

```csharp
public class RandomNumberService
{
    public int Value => _Value;
    private int _Value = 0;
    public event EventHandler NumberChanged;

    public void NewNumber()
    {
        var rand = new Random();
        NotifyNumberChanged(rand.Next(0, 100));
    }

    public void NotifyNumberChanged(int value)
    {
        if (!value.Equals(_Value))
        {
            _Value = value;
            // only trigger event if it has delegates registered
            NumberChanged?.Invoke(this, EventArgs.Empty);
        }
    }
}
```

Add this service to Startup.

```csharp
    public void ConfigureServices(IServiceCollection services)
    {
        services.AddRazorPages();
        services.AddServerSideBlazor();
        ....
        services.AddScoped<RandomNumberService>();
    }
```

Next we build a display component that injects the `RandomNumberService`.  It gets it's value either from the Parameter or from the Service.  It has a button to update the number - this could be a save button in an inline edit form.  if `WireEvent` is true it sets up event wiring.   The component has a bottom row tally to show how many times Initialized, ParamsSet and Render has been called.

```csharp
// We implement IDisposable as we need to unhook the event wiring as part of the component disposal cycle.
@implements IDisposable

<div class="container m-2 px-3 p-t bg-info text-white">
    <div class="row">
        <div class="col-12">
            <h3>@this.Title</h3>
        </div>
    </div>
    <div class="row">
        <div class="col-2">Number</div>
        <div class="col-2">@this.displayValue</div>
        <div class="col-2"><button class="btn btn-secondary" @onclick="(e) => NewRandomNumber()">New Number</button></div>
    </div>
    <div class="row bg-dark mt-2">
        <div class="col-3">
            Initialized:
        </div>
        <div class="col-1">
            @this.InitRun
        </div>
        <div class="col-3">
            Params Set:
        </div>
        <div class="col-1">
            @this.ParamsSetRun
        </div>
        <div class="col-3">
            Rendered:
        </div>
        <div class="col-1">
            @this.Rendered
        </div>
    </div>
</div>

@code {
    [Inject] private RandomNumberService RdmService { get; set; }

    // Property to control if we wire up to the service event
    [Parameter] public bool WireEvent { get; set; }

    [Parameter] public string Title { get; set; }

    [Parameter] public int Value { get; set; } = 0;

    // Get the Display value.  If the Parameter Value is 0 (not set) then we get the value from the service
    private int displayValue => this.Value > 0 ? this.Value : RdmService.Value;

    protected override Task OnInitializedAsync()
    {
        this.InitRun++;
        if (this.WireEvent)
            this.RdmService.NumberChanged += this.OnNumberChange;

        return base.OnInitializedAsync();
    }

    private void NewRandomNumber()
    => RdmService.NewNumber();

    // Note that we use InvokeAsync to ensure StateHasChanged is run on the Synchronization Context thread.
    private async void OnNumberChange(object sender, EventArgs e)
        => await this.InvokeAsync(StateHasChanged);

    private int InitRun = 0;
    private int ParamsSetRun = 0;
    private int Rendered = 1;

    protected override Task OnParametersSetAsync()
    {
        this.ParamsSetRun++;
        return base.OnParametersSetAsync();
    }

    // We overide ShouldRender to get it increment the counter
    // ShouldRender is called as part of the process to queue a render request
    // we start the counter at 1 as it doesn't get called during the Initialization process
    protected override bool ShouldRender()
    {
        Rendered++;
        return true;
    }

    // IDisposable implementation
    public void Dispose()
    {
        if (this.WireEvent)
            this.RdmService.NumberChanged -= this.OnNumberChange;
    }
}
```  

Finally we have a razor display page

```csharp
@page "/Random"

<div class="container m-2 px-3 p-t bg-primary text-white">
    <div class="row">
        <div class="col-12">
            <h3>@this.Title</h3>
        </div>
    </div>
    <div class="row">
        <div class="col-2">Number</div>
        <div class="col-2">@RdmService.Value</div>
        <div class="col-2"><button class="btn btn-secondary" @onclick="(e) => NewRandomNumber()">New Number</button></div>
    </div>
    <div class="row bg-dark mt-2">
        <div class="col-3">
            Initialized:
        </div>
        <div class="col-1">
            @this.InitRun
        </div>
        <div class="col-3">
            Params Set:
        </div>
        <div class="col-1">
            @this.ParamsSetRun
        </div>
        <div class="col-3">
            Rendered:
        </div>
        <div class="col-1">
            @this.Rendered
        </div>
    </div>
</div>

<ValueDisplay Title="Unwired Display"></ValueDisplay>
<ValueDisplay WireEvent="true" Title="Wired Display"></ValueDisplay>
<ValueDisplay Value="RdmService.Value" Title="Parameter Display"></ValueDisplay>

@code {
    private string Title = "Root";

    [Inject] private RandomNumberService RdmService { get; set; }

    private void NewRandomNumber()
        => RdmService.NewNumber();

    private int InitRun = 0;
    private int ParamsSetRun = 0;
    private int Rendered = 1;

    protected override Task OnInitializedAsync()
    {
        InitRun++;
        return base.OnInitializedAsync();
    }

    protected override Task OnParametersSetAsync()
    {
        this.ParamsSetRun++;
        return base.OnParametersSetAsync();
    }

    protected override bool ShouldRender()
    {
        Rendered++;
        return true;
    }
}
```

Once you have this running you can see what happens when you update the number in various controls within the page.  The sure-fire method is the event driven update.





